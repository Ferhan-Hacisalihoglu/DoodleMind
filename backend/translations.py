# -*- coding: utf-8 -*-
"""
Class name formatting for TU-Berlin sketch categories in clean English.
"""

CLEAN_NAMES_EN = {
    "bear (animal)": "Bear",
    "car (sedan)": "Car",
    "crane (machine)": "Crane",
    "flower with stem": "Flower",
    "mouse (animal)": "Mouse",
    "pipe (for smoking)": "Pipe",
    "sponge bob": "SpongeBob",
    "t-shirt": "T-Shirt",
    "wrist-watch": "Watch",
    "beer-mug": "Beer Mug",
    "flying bird": "Bird (Flying)",
    "standing bird": "Bird (Standing)",
    "computer-mouse": "Computer Mouse",
    "head-phones": "Headphones",
    "hot-dog": "Hot Dog",
    "ice-cream-cone": "Ice Cream Cone",
    "person sitting": "Person Sitting",
    "person walking": "Person Walking",
    "tablelamp": "Table Lamp",
    "wineglass": "Wine Glass",
    "wine-bottle": "Wine Bottle"
}

def get_class_display_name(class_name: str) -> str:
    """Returns a clean, title-cased English name for any of the 250 classes."""
    if class_name in CLEAN_NAMES_EN:
        return CLEAN_NAMES_EN[class_name]
    return class_name.title()

def get_class_info(class_name: str):
    display_name = get_class_display_name(class_name)
    return {
        "name_en": class_name,
        "display_name": display_name,
        "name_tr": display_name, # Backwards compatibility if needed
        "icon": "✏️"
    }

