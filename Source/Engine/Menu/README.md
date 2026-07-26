# Module: Menu

## Structure
- `MenuModel.hpp/.cpp` — items, cursor navigation, activation callbacks.
- `MenuStack.hpp/.cpp` — a push/pop stack of menus for navigation.

## Description
UI-agnostic menu **state**: an ordered list of selectable items with a moving
cursor that wraps and skips disabled entries, plus a stack modelling submenu
navigation. There is no rendering and no input polling here — a renderer draws
the model and the InputSystem drives navigation.

## Responsibilities
- Track selection and move it between enabled items (wrap-around).
- Invoke the selected item's callback on activation.
- Model open/back navigation via a menu stack.

## Dependencies
- **Core/Types**. Layer L2. Rendering and input are intentionally external.
