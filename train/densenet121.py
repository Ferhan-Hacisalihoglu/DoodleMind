# --- import libraries ---
import os
import io
import json
import copy
import torch
from torch import nn, optim
from torchvision import transforms, datasets, models
from torch.utils.data import DataLoader, Dataset
from sklearn.model_selection import train_test_split
from PIL import Image
import numpy as np
from tqdm import tqdm

# Enable CuDNN benchmark for optimal convolution algorithm selection with fixed input size
torch.backends.cudnn.benchmark = True
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# --- directory paths ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
MODELS_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(MODELS_DIR, exist_ok=True)

# --- sketch-tailored data preprocessing and augmentation ---
# Optimized for high throughput: replaced heavy ElasticTransform with fast RandomPerspective + Affine
transform_train = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.RandomHorizontalFlip(p=0.5),
    transforms.RandomAffine(
        degrees=15,
        translate=(0.1, 0.1),
        scale=(0.85, 1.15),
        shear=5,
        fill=255
    ),
    transforms.RandomPerspective(distortion_scale=0.2, p=0.5, fill=255),
    transforms.ColorJitter(brightness=0.25, contrast=0.25),
    transforms.ToTensor(),
    transforms.RandomErasing(p=0.25, scale=(0.02, 0.2), ratio=(0.3, 3.3), value=1.0),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

transform_test = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# --- in-memory cached dataset wrapper ---
class CachedSketchDataset(Dataset):
    """Caches image bytes in RAM to eliminate disk I/O bottlenecks during training."""
    def __init__(self, samples, transform=None):
        self.samples = samples
        self.transform = transform

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_bytes, label = self.samples[idx]
        image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        if self.transform is not None:
            image = self.transform(image)
        return image, label


# --- load dataset & stratified train / test split ---
raw_dataset = datasets.ImageFolder(root=DATA_DIR)
class_names = raw_dataset.classes
num_classes = len(class_names)
print(f"Loaded dataset from: {DATA_DIR}")
print(f"Found {num_classes} classes and {len(raw_dataset)} sketches in total.")

class_names_path = os.path.join(MODELS_DIR, "class_names.json")
with open(class_names_path, "w", encoding="utf-8") as f:
    json.dump(class_names, f, ensure_ascii=False, indent=2)
print(f"Saved class labels to: {class_names_path}")

# Preload all images into RAM once (~133 MB)
cached_samples = [(open(path, "rb").read(), target) for path, target in tqdm(raw_dataset.samples, desc="RAM Caching")]

# Stratified split: 75% train, 25% test for every class (random_state=42)
train_indices, test_indices = train_test_split(
    np.arange(len(raw_dataset.targets)),
    test_size=0.25,
    stratify=raw_dataset.targets,
    random_state=42
)

train_samples = [cached_samples[i] for i in train_indices]
test_samples = [cached_samples[i] for i in test_indices]

train_dataset = CachedSketchDataset(train_samples, transform=transform_train)
test_dataset = CachedSketchDataset(test_samples, transform=transform_test)

print(f"Split completed -> Train: {len(train_dataset)} sketches, Test: {len(test_dataset)} sketches")

batch_size = 64
pin_memory = torch.cuda.is_available()
num_workers = 4 if os.name != 'nt' else 2

train_loader = DataLoader(
    train_dataset,
    batch_size=batch_size,
    shuffle=True,
    num_workers=num_workers,
    pin_memory=pin_memory,
    persistent_workers=(num_workers > 0)
)
test_loader = DataLoader(
    test_dataset,
    batch_size=batch_size,
    shuffle=False,
    num_workers=num_workers,
    pin_memory=pin_memory,
    persistent_workers=(num_workers > 0)
)

# --- define transfer learning model (DenseNet121) and fine-tuning ---
model = models.densenet121(weights=models.DenseNet121_Weights.DEFAULT)

num_ftrs = model.classifier.in_features
model.classifier = nn.Linear(num_ftrs, num_classes)

# Freeze base feature extractor layers
for param in model.features.parameters():
    param.requires_grad = False

# Unfreeze denseblock2, transition2, denseblock3, transition3, denseblock4 and norm5 for fine-tuning
for param in model.features.denseblock2.parameters():
    param.requires_grad = True

for param in model.features.transition2.parameters():
    param.requires_grad = True

for param in model.features.denseblock3.parameters():
    param.requires_grad = True

for param in model.features.transition3.parameters():
    param.requires_grad = True

for param in model.features.denseblock4.parameters():
    param.requires_grad = True

for param in model.features.norm5.parameters():
    param.requires_grad = True

# Ensure classifier parameters are trainable
for param in model.classifier.parameters():
    param.requires_grad = True

model = model.to(device)

# --- early stopping callback ---
class EarlyStopping:
    def __init__(self, patience=5, min_delta=1e-3, checkpoint_path=None):
        self.patience = patience
        self.min_delta = min_delta
        self.best_loss = np.inf
        self.counter = 0
        self.early_stop = False
        self.best_model_wts = None
        self.checkpoint_path = checkpoint_path

    def __call__(self, val_loss, model):
        if val_loss < self.best_loss - self.min_delta:
            self.best_loss = val_loss
            self.counter = 0
            self.best_model_wts = copy.deepcopy(model.state_dict())
            if self.checkpoint_path:
                torch.save(self.best_model_wts, self.checkpoint_path)
            return False
        else:
            self.counter += 1
            if self.counter >= self.patience:
                self.early_stop = True
                return True
            return False


# --- loss, optimizer, lr scheduler & mixed precision scaler ---
criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam([
    {'params': [p for p in model.features.parameters() if p.requires_grad], 'lr': 1e-5},
    {'params': model.classifier.parameters(), 'lr': 1e-3}
], weight_decay=1e-4)

scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', factor=0.1, patience=3)
scaler = torch.amp.GradScaler('cuda', enabled=(device.type == 'cuda'))

epochs = 60
model_save_path = os.path.join(MODELS_DIR, "densenet121_tuberlin.pth")
early_stopping = EarlyStopping(patience=6, min_delta=1e-3, checkpoint_path=model_save_path)

# --- training and validation loop ---
if __name__ == '__main__':
    print(f"\nTraining DenseNet121 on device: {device} (AMP Mixed Precision: {device.type == 'cuda'})")
    print(f"Output model target: {model_save_path}\n")

    for epoch in range(epochs):
        model.train()
        running_loss = 0.0
        correct_train = 0
        total_train = 0

        train_bar = tqdm(train_loader, desc=f"Epoch {epoch+1:02d}/{epochs:02d} [Train]")
        for images, labels in train_bar:
            images = images.to(device, non_blocking=True)
            labels = labels.to(device, non_blocking=True)

            optimizer.zero_grad(set_to_none=True)
            with torch.amp.autocast('cuda', enabled=(device.type == 'cuda')):
                outputs = model(images)
                loss = criterion(outputs, labels)

            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()

            running_loss += loss.item() * images.size(0)
            _, preds = torch.max(outputs, 1)
            correct_train += torch.sum(preds == labels.data).item()
            total_train += labels.size(0)

            train_bar.set_postfix(loss=f"{loss.item():.5f}")

        epoch_train_loss = running_loss / total_train
        epoch_train_acc = correct_train / total_train

        model.eval()
        val_loss = 0.0
        correct_val = 0
        total_val = 0

        with torch.no_grad():
            for images, labels in test_loader:
                images = images.to(device, non_blocking=True)
                labels = labels.to(device, non_blocking=True)

                with torch.amp.autocast('cuda', enabled=(device.type == 'cuda')):
                    outputs = model(images)
                    loss = criterion(outputs, labels)

                val_loss += loss.item() * images.size(0)
                _, preds = torch.max(outputs, 1)
                correct_val += torch.sum(preds == labels.data).item()
                total_val += labels.size(0)

        epoch_val_loss = val_loss / total_val
        epoch_val_acc = correct_val / total_val

        scheduler.step(epoch_val_loss)

        print(f"Epoch [{epoch+1:02d}/{epochs:02d}] | "
              f"Train Loss: {epoch_train_loss:.5f} - Train Acc: {epoch_train_acc:.5f} | "
              f"Val Loss: {epoch_val_loss:.5f} - Val Acc: {epoch_val_acc:.5f}")

        if early_stopping(epoch_val_loss, model):
            print(f"Early stopping triggered at epoch {epoch+1}. Best Val Loss: {early_stopping.best_loss:.5f}")
            break

    # Save final / best confirmation
    if early_stopping.best_model_wts is not None:
        print(f"\nSuccessfully saved best model weights to: {model_save_path}")
    else:
        torch.save(model.state_dict(), model_save_path)
        print(f"\nSaved final model weights to: {model_save_path}")
