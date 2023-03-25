(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.firjs = {}));
})(this, (function (exports) { 'use strict';

    function readMousePosition(e) {
        const vector = {
            x: e.clientX,
            y: e.clientY,
        };
        return vector;
    }
    var MouseButton;
    (function (MouseButton) {
        MouseButton["LEFT"] = "LEFT";
        MouseButton["MIDDLE"] = "MIDDLE";
        MouseButton["RIGHT"] = "RIGHT";
        MouseButton["FOURTH"] = "FOURTH";
        MouseButton["FIFTH"] = "FIFTH";
    })(MouseButton || (MouseButton = {}));
    function buttonIndexToType(buttonIndex) {
        switch (buttonIndex) {
            case 0: return MouseButton.LEFT;
            case 1: return MouseButton.MIDDLE;
            case 2: return MouseButton.RIGHT;
            case 3: return MouseButton.FOURTH;
            case 4: return MouseButton.FIFTH;
            default: return MouseButton.LEFT;
        }
    }

    function subtract(v1, v2) {
        return {
            x: v1.x - v2.x,
            y: v1.y - v2.y
        };
    }
    function distance(vector) {
        return Math.sqrt(Math.pow(vector.x, 2) + Math.pow(vector.y, 2));
    }

    function getComponentPositionInWorkspace(component) {
        return getElementPositionInWorkspace(component.view.element, component.context);
    }
    function getElementPositionInWorkspace(element, context) {
        const componentClientRect = element.getBoundingClientRect();
        let componentClientRectX = componentClientRect.x;
        let componentClientRectY = componentClientRect.y;
        const workspaceRect = context.designerState.workspaceRect;
        if (workspaceRect) {
            componentClientRectX = componentClientRectX - workspaceRect.left;
            componentClientRectY = componentClientRectY - workspaceRect.top;
        }
        return {
            x: componentClientRectX,
            y: componentClientRectY,
        };
    }
    function getVectorPositionInWorkspace(startPosition, context) {
        const workspaceRect = context.designerState.workspaceRect;
        if (workspaceRect) {
            startPosition.x = startPosition.x - workspaceRect.left;
            startPosition.y = startPosition.y - workspaceRect.top;
        }
        return {
            x: startPosition.x,
            y: startPosition.y,
        };
    }

    function instanceOfComponentWithNode(value) {
        if (typeof value !== 'object')
            return false;
        return 'node' in value && instanceOfSequenceNode(value.node);
    }
    function instanceOfSequenceNode(value) {
        if (typeof value !== 'object')
            return false;
        return 'id' in value && 'type' in value;
    }

    class PlaceholderFinder {
        constructor(placeholders) {
            this.placeholders = placeholders;
        }
        static create(placeholders) {
            return new PlaceholderFinder(placeholders);
        }
        findByPosition(mousePosition, componentWidth, componentHeight) {
            this._cache = [];
            for (const placeholder of this.placeholders) {
                const position = getComponentPositionInWorkspace(placeholder);
                this._cache?.push({
                    placeholder,
                    letTopPosition: { x: position.x, y: position.y },
                    bottomRightPosition: { x: position.x + placeholder.view.width, y: position.y + placeholder.view.height }
                });
            }
            this._cache.sort((a, b) => a.letTopPosition.y - b.letTopPosition.y);
            const vR = mousePosition.x + componentWidth;
            const vB = mousePosition.y + componentHeight;
            for (const cacheItem of this._cache) {
                if (Math.max(mousePosition.x, cacheItem.letTopPosition.x) < Math.min(vR, cacheItem.bottomRightPosition.x) && Math.max(mousePosition.y, cacheItem.letTopPosition.y) < Math.min(vB, cacheItem.bottomRightPosition.y)) {
                    return cacheItem.placeholder;
                }
            }
        }
    }

    class SequenceModifier {
        static move(sourceSequence, component, targetSequence, targetIndex) {
            const node = component.node;
            const sourceIndex = sourceSequence.nodes.indexOf(node);
            if (sourceIndex < 0) {
                throw new Error('Unknown step');
            }
            const isSameSequence = sourceSequence === targetSequence;
            if (isSameSequence && sourceIndex === targetIndex) {
                return; // Nothing to do.
            }
            sourceSequence.nodes.splice(sourceIndex, 1);
            if (isSameSequence && sourceIndex < targetIndex) {
                targetIndex--;
            }
            targetSequence.nodes.splice(targetIndex, 0, node);
            const context = targetSequence.context;
            if (context.onDefinitionChange) {
                context.onDefinitionChange(targetSequence.context.tree, true);
            }
        }
        static add(sequence, component, index) {
            sequence.nodes.splice(index, 0, component.node);
            if (sequence.context.onDefinitionChange) {
                sequence.context.onDefinitionChange(sequence.context.tree, true);
            }
        }
        static remove(sequence, component) {
            const index = sequence.nodes.findIndex(e => e.id === component.node.id);
            sequence.nodes.splice(index, 1);
            if (sequence.context.userDefinedListeners?.onNodeRemove) {
                sequence.context.userDefinedListeners.onNodeRemove({
                    node: component.node,
                    parent: null, // TODO
                });
            }
            if (sequence.context.onDefinitionChange) {
                sequence.context.onDefinitionChange(sequence.context.tree, true);
            }
        }
    }

    class DomHelper {
        static svg(name, attributes) {
            const element = document.createElementNS("http://www.w3.org/2000/svg", name);
            if (attributes) {
                DomHelper.attributes(element, attributes);
            }
            return element;
        }
        static element(name, attributes) {
            const el = document.createElement(name);
            if (attributes) {
                DomHelper.attributes(el, attributes);
            }
            return el;
        }
        static attributes(element, attributes) {
            for (const key of Object.keys(attributes)) {
                const value = attributes[key];
                element.setAttribute(key, (typeof value === 'string') ? value : value.toString());
            }
        }
        static translate(element, x, y) {
            element.setAttribute('transform', `translate(${x}, ${y})`);
        }
    }

    class DragView {
        constructor(element, parent, context) {
            this.element = element;
            this.parent = parent;
            this.context = context;
        }
        static create(componentInstance, context) {
            const componentView = componentInstance.view;
            if (componentView.setDragging) {
                componentView.setDragging(true);
            }
            let clone;
            let width;
            let height;
            clone = componentView.element.cloneNode(true);
            width = componentView.width;
            height = componentView.height;
            clone.removeAttribute('transform');
            const zoomLevel = context.designerState.zoomLevel;
            clone.setAttribute('transform', `scale(${zoomLevel})`);
            const dragSvg = DomHelper.svg('svg', {
                class: 'drag-ghost',
                width: width + width * zoomLevel,
                height: height + height * zoomLevel,
            });
            dragSvg.style.position = 'absolute';
            dragSvg.style.zIndex = '10';
            dragSvg.appendChild(clone);
            const parent = document.getElementById('workspace-root');
            if (parent) {
                parent.appendChild(dragSvg);
            }
            return new DragView(dragSvg, document.body, context);
        }
        destroy() {
            this.element.remove();
        }
    }

    class MoveComponentInteraction {
        constructor(dragView, draggedComponent, placeholderFinder, context) {
            this.dragView = dragView;
            this.draggedComponent = draggedComponent;
            this.placeholderFinder = placeholderFinder;
            this.context = context;
            this._currentPlaceholder = null;
            this._dragEnded = false;
        }
        static create(componentInstance, context) {
            const dragView = DragView.create(componentInstance, context);
            const placeholderFinder = PlaceholderFinder.create(context.designerState?.placeholders ? context.designerState.placeholders : []);
            return new MoveComponentInteraction(dragView, componentInstance, placeholderFinder, context);
        }
        onStart(startMousePosition) {
            this._startPosition = startMousePosition;
            if (this.draggedComponent) {
                const componentPosition = getComponentPositionInWorkspace(this.draggedComponent);
                this._mouseClickOffsetFromComponent = subtract(startMousePosition, {
                    x: componentPosition.x,
                    y: componentPosition.y,
                });
            }
            else {
                this._mouseClickOffsetFromComponent = {
                    x: this.dragView.element.clientWidth / 2,
                    y: this.dragView.element.clientHeight / 2
                };
            }
            const placeholders = this.context.designerState.placeholders;
            if (placeholders) {
                for (const placeholder of placeholders) {
                    if (this.draggedComponent.view.element.contains(placeholder.view.element))
                        continue;
                    placeholder.show();
                }
            }
            // Force terminate drag on Escape
            window.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    this._terminateDrag();
                    return;
                }
            });
        }
        onMove(delta) {
            let newPosition = subtract(this._startPosition, delta);
            newPosition = subtract(newPosition, this._mouseClickOffsetFromComponent);
            this.dragView.element.style.left = newPosition.x + "px";
            this.dragView.element.style.top = newPosition.y + "px";
            const placeholder = this.placeholderFinder.findByPosition(newPosition, this.draggedComponent.view.width, this.draggedComponent.view.height);
            const placeholderIsAChildOfDraggedComponent = placeholder && this.draggedComponent.view.element.contains(placeholder.view.element);
            if (placeholder && !placeholderIsAChildOfDraggedComponent) {
                if (this._currentPlaceholder) {
                    this._currentPlaceholder.setIsHover(false);
                    this._currentPlaceholder = placeholder;
                }
                else {
                    this._currentPlaceholder = placeholder;
                }
                this._currentPlaceholder.setIsHover(true);
            }
            else {
                if (this._currentPlaceholder) {
                    this._currentPlaceholder.setIsHover(false);
                }
                this._currentPlaceholder = null;
            }
        }
        onEnd() {
            if (this._dragEnded)
                return;
            if (this._currentPlaceholder && instanceOfComponentWithNode(this.draggedComponent)) {
                const sourceSequence = this.draggedComponent.parentSequence;
                const targetSequence = this._currentPlaceholder.parentSequence;
                // Check if we are going to put a sequence inside a child of it
                if (this.draggedComponent.view.element.contains(targetSequence.view.element)) {
                    this._terminateDrag();
                    return;
                }
                if (sourceSequence && targetSequence) {
                    const canDropNodeFn = this.context.userDefinedListeners?.canDropNode;
                    const currentPlaceholderIndex = this._currentPlaceholder.index;
                    const draggedComponent = this.draggedComponent;
                    if (canDropNodeFn) {
                        canDropNodeFn({
                            node: this.draggedComponent.node,
                            parent: this.draggedComponent.parentNode,
                            action: "move",
                        }).then((result) => {
                            if (result === true) {
                                SequenceModifier.move(sourceSequence, draggedComponent, targetSequence, currentPlaceholderIndex);
                            }
                        });
                    }
                    else {
                        SequenceModifier.move(sourceSequence, draggedComponent, targetSequence, currentPlaceholderIndex);
                    }
                }
            }
            this._terminateDrag();
        }
        _terminateDrag() {
            if (this.draggedComponent.view.setDragging) {
                this.draggedComponent.view.setDragging(false);
            }
            if (this.context.designerState.placeholders) {
                for (const placeholder of this.context.designerState.placeholders) {
                    placeholder.hide();
                }
            }
            this.dragView.destroy();
            this._dragEnded = true;
        }
    }

    class SelectComponentInteraction {
        constructor(componentInstance, context) {
            this.componentInstance = componentInstance;
            this.context = context;
            this._offsetForDrag = 4;
        }
        static create(componentInstance, context) {
            return new SelectComponentInteraction(componentInstance, context);
        }
        onStart(position) {
            // NOOP
        }
        onMove(delta) {
            if (distance(delta) > this._offsetForDrag) {
                if (this.componentInstance.view.setSelected) {
                    this.componentInstance.view.setSelected(false);
                }
                return MoveComponentInteraction.create(this.componentInstance, this.context);
            }
        }
        onEnd() {
            // NOOP
        }
    }

    class UserInteractionController {
        constructor() {
            this._onMouseMoveHandler = (e) => this._onMouseMove(e);
            this._onMouseUpHandler = (e) => this._onMouseUp(e);
            this._onKeyboardPressHandler = (e) => this._onKeyPress(e);
            this._onKeyboardReleaseHandler = (e) => this._onKeyRelease(e);
        }
        handleClickInteraction(interaction, startPosition) {
            this._clickInteractionState = {
                userInteraction: interaction,
                startPosition,
            };
            interaction.onStart(startPosition);
            window.addEventListener('mousemove', this._onMouseMoveHandler, false);
            window.addEventListener('mouseup', this._onMouseUpHandler, false);
        }
        handleWheelInteraction(interaction, event) {
            interaction.onWheel(event.deltaY);
        }
        handleDragInteraction(userInteraction, startPosition) {
            this._clickInteractionState = {
                userInteraction,
                startPosition,
            };
            userInteraction.onStart(startPosition);
            window.addEventListener('drag', this._onMouseMoveHandler, false);
            window.addEventListener('dragend', this._onMouseUpHandler, false);
        }
        handleKeyboardInteraction(userInteraction) {
            this._keyboardInteractionState = {
                keyboardInteraction: userInteraction,
            };
            window.addEventListener('keydown', this._onKeyboardPressHandler, false);
            window.addEventListener('keyup', this._onKeyboardReleaseHandler, false);
        }
        _onMouseMove(e) {
            e.preventDefault();
            const currentPosition = readMousePosition(e);
            const delta = subtract(this._clickInteractionState.startPosition, currentPosition);
            const moveInteraction = this._clickInteractionState.userInteraction.onMove(delta);
            if (moveInteraction) {
                // Stop previous interaction
                this._clickInteractionState.userInteraction.onEnd();
                // Start a new interaction
                this._clickInteractionState.userInteraction = moveInteraction;
                this._clickInteractionState.startPosition = currentPosition;
                this._clickInteractionState.userInteraction.onStart(this._clickInteractionState.startPosition);
            }
        }
        _onMouseUp(e) {
            e.preventDefault();
            window.removeEventListener('mousemove', this._onMouseMoveHandler, false);
            window.removeEventListener('drag', this._onMouseMoveHandler, false);
            this._clickInteractionState.userInteraction.onEnd();
        }
        _onKeyPress(e) {
            this._keyboardInteractionState.keyboardInteraction.onPress(e);
        }
        _onKeyRelease(e) {
            this._keyboardInteractionState.keyboardInteraction.onRelease(e);
        }
    }

    class BackgroundView {
        constructor(element, parent) {
            this.element = element;
            this.parent = parent;
        }
        static create(parent) {
            const canvas = DomHelper.svg('svg', {
                class: 'bg',
                width: "100%",
                height: "100%",
            });
            const defs = DomHelper.svg('defs');
            const gridPattern = DomHelper.svg('pattern', {
                id: "bg-pattern",
                patternUnits: "userSpaceOnUse",
                width: "16",
                height: "16",
            });
            const background = DomHelper.svg('rect', {
                fill: "url(#bg-pattern)",
                width: "100%",
                height: "100%",
            });
            const gridPatternCircle = DomHelper.svg("circle", {
                class: "grid-pattern-circle",
                r: 1,
                cx: 1,
                cy: 1,
            });
            canvas.appendChild(defs);
            canvas.appendChild(background);
            defs.appendChild(gridPattern);
            gridPattern.appendChild(gridPatternCircle);
            parent.appendChild(canvas);
            return new BackgroundView(canvas, parent);
        }
    }

    class Background {
        constructor(view) {
            this.view = view;
        }
        static create(parent) {
            const view = BackgroundView.create(parent);
            return new Background(view);
        }
    }

    class ChildlessComponent {
        constructor(view, context) {
            this.view = view;
            this.context = context;
            context.designerState?.selectedNode.subscribe((data) => {
                if (data && data === this) {
                    if (this.view.setSelected) {
                        this.view.setSelected(true);
                    }
                }
                else {
                    if (this.view.setSelected) {
                        this.view.setSelected(false);
                    }
                }
            });
        }
        findByClick(click) {
            const viewContains = this.view.element.contains(click.target);
            if (viewContains) {
                return this;
            }
            return null;
        }
    }

    class LabelView {
        constructor(element, textLength) {
            this.element = element;
            this.textLength = textLength;
        }
        static create(text, context, props) {
            let classes = ['label'];
            if (props?.class) {
                classes = [
                    ...classes,
                    ...props.class,
                ];
            }
            const label = DomHelper.svg("text", {
                class: classes.join(' '),
                stroke: props?.color ? props.color : "currentColor",
                fill: props?.color ? props.color : "currentColor",
                "text-anchor": "middle",
                "dominant-baseline": "middle",
                "font-size": context.options.style.fontSize,
                'font-family': context.options.style.fontFamily,
            });
            label.append(text.trim());
            const parentG = DomHelper.svg('g', {
                class: "label-text-container",
            });
            parentG.appendChild(label);
            const textLength = LabelView._calculateTextLenght(label);
            return new LabelView(parentG, textLength);
        }
        /**
         * This is a workaround to pre calculate the label size.
         */
        static _calculateTextLenght(label) {
            const temporarySvg = DomHelper.svg('svg', {
                class: "label-svg",
                width: '100%',
            });
            temporarySvg.appendChild(label.cloneNode(true));
            document.body.appendChild(temporarySvg);
            const textLength = temporarySvg.firstChild?.getComputedTextLength();
            document.body.removeChild(temporarySvg);
            return textLength;
        }
    }
    LabelView.defaultWidth = 200;

    class EndView {
        constructor(element, parent, width, height, joinX) {
            this.element = element;
            this.parent = parent;
            this.width = width;
            this.height = height;
            this.joinX = joinX;
        }
        static create(parent, context) {
            const diameter = 60;
            const radius = diameter / 2;
            const element = DomHelper.svg('g', {
                class: "end",
            });
            const circle = DomHelper.svg('circle', {
                class: "end-bg",
                "stroke-width": 1,
                r: radius,
                cx: 0,
                cy: radius,
            });
            const label = LabelView.create('End', context);
            DomHelper.translate(label.element, 0, radius);
            element.appendChild(circle);
            element.appendChild(label.element);
            parent.appendChild(element);
            return new EndView(element, parent, diameter, diameter, diameter / 2);
        }
    }

    class End extends ChildlessComponent {
        static create(parent, context) {
            const view = EndView.create(parent, context);
            return new End(view, context);
        }
    }

    class PlaceholderView {
        constructor(element, width, height, joinX) {
            this.element = element;
            this.width = width;
            this.height = height;
            this.joinX = joinX;
        }
        static create(parent) {
            const g = DomHelper.svg('g', {
                class: 'placeholder-area',
                opacity: 0,
            });
            parent.appendChild(g);
            g.appendChild(DomHelper.svg('rect', {
                class: 'placeholder-drop-area',
                width: PlaceholderView.width,
                height: PlaceholderView.height,
            }));
            g.appendChild(DomHelper.svg('rect', {
                class: 'placeholder-selector',
                width: PlaceholderView.width,
                height: 5,
                y: PlaceholderView.height / 2,
                rx: 4,
            }));
            const placeholderView = new PlaceholderView(g, PlaceholderView.width, PlaceholderView.height, PlaceholderView.width / 2);
            placeholderView._placeholderGroup = g;
            return placeholderView;
        }
        showPlaceholder() {
            this._placeholderGroup.style.opacity = "0.25";
        }
        hidePlaceholder() {
            this._placeholderGroup.style.opacity = "0";
        }
        toggleHover(value) {
            if (value) {
                this._placeholderGroup.style.opacity = "1";
            }
            else {
                this._placeholderGroup.style.opacity = "0.25";
            }
        }
    }
    PlaceholderView.width = 100;
    PlaceholderView.height = 35;

    class JoinView {
        static createStraightJoin(parent, start, height, context) {
            const line = DomHelper.svg('line', {
                class: "join-line",
                x1: start.x,
                y1: start.y,
                x2: start.x,
                y2: start.y + height,
            });
            parent.appendChild(line);
            return line;
        }
        static createConnectionJoin(parent, start, height, context) {
            const line = JoinView.createStraightJoin(parent, start, height, context);
            if (height) {
                line.setAttribute("marker-end", "url(#arrowEnd)");
            }
            return line;
        }
    }

    var img$2 = "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' height='48' width='48'%3e%3cpath d='M21.75 40.85v-15.8l-9.9-9.9v4.95h-4.7V7.15H20.1v4.7h-4.9L26.45 23.1v17.75Zm7.7-19-3.3-3.3 6.55-6.7h-4.8v-4.7h12.95V20.1h-4.7v-4.85Z'/%3e%3c/svg%3e";

    class LabelContainer {
        static create(props) {
            let classes = ['label-container'];
            if (props.class) {
                classes = [
                    ...classes,
                    ...props.class,
                ];
            }
            const container = DomHelper.svg("rect", {
                class: classes.join(' '),
                width: props.width,
                height: props.height,
                "stroke-width": "1",
                rx: 4,
                x: 0,
                y: 0,
            });
            return container;
        }
    }

    var img$1 = "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' height='48' width='48'%3e%3cpath d='M24 40q-1 0-1.7-.7t-.7-1.7q0-1 .7-1.7t1.7-.7q1 0 1.7.7t.7 1.7q0 1-.7 1.7T24 40Zm0-13.6q-1 0-1.7-.7t-.7-1.7q0-1 .7-1.7t1.7-.7q1 0 1.7.7t.7 1.7q0 1-.7 1.7t-1.7.7Zm0-13.6q-1 0-1.7-.7t-.7-1.7q0-1 .7-1.7T24 8q1 0 1.7.7t.7 1.7q0 1-.7 1.7t-1.7.7Z'/%3e%3c/svg%3e";

    class StepView {
        constructor(element, width, height) {
            this.element = element;
            this.width = width;
            this.height = height;
        }
        static async create(node, context, props) {
            const step = DomHelper.svg('g', {
                class: 'step',
            });
            const container = LabelContainer.create({
                ...props?.container,
                width: StepView.defaultWidth,
                height: StepView.defaultHeight,
            });
            step.appendChild(container);
            let customIcon = node?.icon;
            if (context.userDefinedOverriders?.overrideIcon) {
                customIcon = await context.userDefinedOverriders.overrideIcon(node);
            }
            const iconContainer = StepView._createIcons(customIcon);
            step.appendChild(iconContainer);
            let text = "";
            if (context?.userDefinedOverriders?.overrideLabel) {
                text = await context.userDefinedOverriders.overrideLabel(node);
            }
            else {
                text = node?.label ? node.label : node.id;
            }
            const label = LabelView.create(text, context, {
                ...props?.label,
            });
            step.appendChild(label.element);
            let containerWidth = StepView.defaultWidth;
            const iconMarginRight = 10;
            const totalIconSizes = iconMarginRight + ((customIcon) ? (22 + StepView.defaultHeight) : 22);
            const labelWidth = label.textLength;
            if (labelWidth + totalIconSizes > containerWidth) {
                containerWidth = labelWidth + totalIconSizes * 2;
            }
            else {
                containerWidth = containerWidth + totalIconSizes / 2;
            }
            const labelOffsetX = containerWidth / 2;
            const labelOffsetY = StepView.defaultHeight / 2;
            DomHelper.translate(label.element, labelOffsetX, labelOffsetY);
            container.setAttribute('width', containerWidth.toString());
            return new StepView(step, containerWidth, StepView.defaultHeight);
        }
        static _createIcons(customIcon) {
            const iconContainer = DomHelper.svg('g', {
                class: 'label-icon-container',
            });
            const dragIconSize = 22;
            iconContainer.appendChild(DomHelper.svg('image', {
                href: img$1,
                width: dragIconSize,
                height: dragIconSize,
                x: 0,
                y: StepView.defaultHeight / 2 - dragIconSize / 2,
                opacity: 0.25,
                cursor: 'move',
            }));
            const iconContainerHeight = StepView.defaultHeight;
            if (customIcon) {
                const customIconContainer = DomHelper.svg('g', {
                    class: "custom-label-container",
                });
                const iconBg = DomHelper.svg('rect', {
                    class: "label-icon-bg",
                    width: iconContainerHeight,
                    height: iconContainerHeight,
                });
                const iconSize = iconContainerHeight;
                const iconImage = DomHelper.svg('image', {
                    class: "label-icon",
                    href: customIcon,
                    width: iconSize,
                    height: iconSize,
                    x: 0,
                    y: 0,
                });
                customIconContainer.appendChild(iconBg);
                customIconContainer.appendChild(iconImage);
                DomHelper.translate(customIconContainer, dragIconSize, 0);
                iconContainer.appendChild(customIconContainer);
            }
            return iconContainer;
        }
    }
    StepView.defaultWidth = 200;
    StepView.defaultHeight = 46;

    function getNodeClasses(node) {
        return [
            `node-${node.id}`,
            `node--type-${node.type}`,
        ];
    }
    function removeNode(componentInstance, context) {
        if (instanceOfComponentWithNode(componentInstance)) {
            const sequence = componentInstance.parentSequence;
            if (!sequence?.nodes)
                return;
            if (context.userDefinedListeners?.canRemoveNode) {
                const event = {
                    node: componentInstance.node,
                    parent: componentInstance.parentNode,
                };
                context.userDefinedListeners.canRemoveNode(event).then((result) => {
                    if (result === true) {
                        SequenceModifier.remove(sequence, componentInstance);
                    }
                });
            }
            else {
                SequenceModifier.remove(sequence, componentInstance);
            }
        }
    }
    function duplicateNode(componentInstance) {
        if (instanceOfComponentWithNode(componentInstance)) {
            const sequence = componentInstance.parentSequence;
            if (!sequence?.nodes)
                return;
            const index = sequence.getNodeIndex(componentInstance.node);
            if (index >= 0) {
                const clone = {
                    ...componentInstance,
                    node: {
                        ...componentInstance.node,
                        id: componentInstance.node.id + '-clone',
                    }
                };
                SequenceModifier.add(sequence, clone, index + 1);
            }
        }
    }

    class ChoiceView {
        constructor(element, parent, width, height, joinX, childSequences) {
            this.element = element;
            this.parent = parent;
            this.width = width;
            this.height = height;
            this.joinX = joinX;
            this.childSequences = childSequences;
        }
        static async create(parentElement, node, context) {
            const element = DomHelper.svg('g', {
                class: "choice",
            });
            element.classList.add(...getNodeClasses(node));
            const stepView = await StepView.create(node, context);
            const choiceLabelWidth = stepView.width;
            const choiceLabelHeight = stepView.height;
            // Bottom circle icon
            const labelIcon = DomHelper.svg('g', {
                class: "map-label-icon",
            });
            labelIcon.appendChild(DomHelper.svg('circle', {
                r: 12,
                cx: choiceLabelWidth / 2,
                cy: choiceLabelHeight + 2,
                class: 'circle-label-icon',
                'stroke-width': 1.25,
            }));
            const iconSize = 20;
            labelIcon.appendChild(DomHelper.svg('image', {
                href: img$2,
                width: iconSize,
                height: iconSize,
                x: choiceLabelWidth / 2 - iconSize / 2,
                y: choiceLabelHeight + 2 - iconSize / 2,
            }));
            const choicesContainer = DomHelper.svg('g', {
                class: "choices-container",
            });
            const choicesContainerBg = DomHelper.svg('rect', {
                class: "choices-container-bg",
                stroke: "rgba(0, 0, 0, 0.5)",
                rx: 6,
                'stroke-dasharray': '3 7',
            });
            choicesContainer.appendChild(choicesContainerBg);
            stepView.element.appendChild(labelIcon);
            // Create choices
            // Set choice total width
            let maxWidth = choiceLabelWidth;
            const props = node.props;
            const choices = props?.choices ? props.choices : [];
            let filteredChoices = choices.filter(e => e.length);
            let totalChoices = (filteredChoices).length;
            const sequences = [];
            let totalColumnsWidth = 0;
            const columnGutter = 50;
            let maxHeight = 0;
            for (let i = 0; i < totalChoices; i++) {
                const nodes = props.choices[i];
                if (!nodes.length)
                    continue;
                const sequence = await Sequence.create(nodes, node, parentElement, context);
                if (!sequence)
                    continue;
                sequences.push(sequence);
                totalColumnsWidth = totalColumnsWidth + sequence.view.width + columnGutter;
                const sequenceHeight = sequence.view.height;
                if (sequenceHeight > maxHeight) {
                    maxHeight = sequenceHeight;
                }
            }
            const choicesContainerTopOffset = choiceLabelHeight + PlaceholderView.height;
            let previousOffset = 0;
            for (const sequence of sequences) {
                const choiceColumn = DomHelper.svg('g', {
                    class: 'choice-column',
                });
                const columnWidth = sequence.view.width + columnGutter;
                const columnOffset = -(totalColumnsWidth - previousOffset);
                const sequenceView = sequence.view;
                choiceColumn.appendChild(sequenceView.element);
                DomHelper.translate(sequenceView.element, columnOffset, PlaceholderView.height / 2);
                const columnJoinX = (previousOffset - totalColumnsWidth - columnGutter / 2) + columnWidth / 2;
                // First connection
                JoinView.createConnectionJoin(choiceColumn, { x: columnJoinX, y: -PlaceholderView.height / 2 }, PlaceholderView.height, context);
                // Last connection
                const joinHeight = maxHeight - sequence.view.height + PlaceholderView.height;
                JoinView.createStraightJoin(choiceColumn, { x: columnJoinX, y: sequence.view.height - PlaceholderView.height / 2 }, joinHeight, context);
                previousOffset = previousOffset + columnWidth;
                choicesContainer.appendChild(choiceColumn);
            }
            maxHeight = maxHeight + PlaceholderView.height / 2;
            if (totalColumnsWidth > maxWidth) {
                maxWidth = totalColumnsWidth;
            }
            DomHelper.translate(choicesContainer, totalColumnsWidth + columnGutter / 2, choicesContainerTopOffset);
            const choicesContainerBgTopOffset = 10;
            const labelOffsetX = (maxWidth - choiceLabelWidth) / 2;
            DomHelper.translate(stepView.element, labelOffsetX, 0);
            const totalHeight = choiceLabelHeight + maxHeight + PlaceholderView.height;
            const joinX = maxWidth / 2;
            // Output connection dot
            const endConnection = DomHelper.svg('circle', {
                r: 6,
                cx: joinX,
                cy: totalHeight,
                class: 'output choicesContainerConnection',
                fill: "black",
                stroke: "black",
            });
            if (sequences.length > 1) {
                const firstColumn = sequences[0];
                const lastColumn = sequences[sequences.length - 1];
                const startX = firstColumn.view.joinX + columnGutter / 2;
                const endX = lastColumn.view.joinX + columnGutter / 2;
                // Start join line
                JoinView.createStraightJoin(element, { x: joinX, y: choicesContainerTopOffset - PlaceholderView.height }, PlaceholderView.height / 2, context);
                // Start horizontal line
                element.appendChild(DomHelper.svg('line', {
                    class: "join-line",
                    x1: startX,
                    y1: choicesContainerTopOffset - PlaceholderView.height / 2,
                    x2: maxWidth - endX,
                    y2: choicesContainerTopOffset - PlaceholderView.height / 2,
                }));
                // End horizontal line
                element.appendChild(DomHelper.svg('line', {
                    class: "join-line",
                    x1: startX,
                    y1: totalHeight,
                    x2: maxWidth - endX,
                    y2: totalHeight,
                }));
            }
            let choicesContainerBgWidth = choiceLabelWidth;
            if (maxWidth > choicesContainerBgWidth) {
                choicesContainerBgWidth = maxWidth;
            }
            choicesContainerBg.setAttribute('width', `${choicesContainerBgWidth}px`);
            choicesContainerBg.setAttribute('height', `${totalHeight}px`);
            DomHelper.translate(choicesContainerBg, -(totalColumnsWidth + columnGutter / 2), -choicesContainerTopOffset + choicesContainerBgTopOffset);
            element.appendChild(endConnection);
            element.appendChild(choicesContainer);
            element.appendChild(stepView.element);
            parentElement.appendChild(element);
            return new ChoiceView(element, parentElement, maxWidth, totalHeight, joinX, sequences);
        }
        setDragging(value) {
            if (value) {
                this.element.classList.add('dragging');
            }
            else {
                this.element.classList.remove('dragging');
            }
        }
        setSelected(status) {
            if (status) {
                this.element.classList.add('selected');
            }
            else {
                this.element.classList.remove('selected');
            }
        }
    }

    class Choice {
        constructor(view, context) {
            this.view = view;
            this.context = context;
            context.designerState?.selectedNode.subscribe((data) => {
                if (data && data === this) {
                    if (this.view.setSelected) {
                        this.view.setSelected(true);
                    }
                }
                else {
                    if (this.view.setSelected) {
                        this.view.setSelected(false);
                    }
                }
            });
        }
        static async create(parentElement, node, parentNode, context) {
            const view = await ChoiceView.create(parentElement, node, context);
            const choice = new Choice(view, context);
            choice.node = node;
            choice.parentNode = parentNode;
            return choice;
        }
        findByClick(click) {
            // Check children
            const sequences = this.view.childSequences;
            for (const sequence of sequences) {
                const component = sequence.findByClick(click);
                if (component) {
                    return component;
                }
            }
            // If no children check if is current view
            const viewContains = this.view.element.contains(click.target);
            if (viewContains) {
                return this;
            }
            return null;
        }
    }

    class ParentComponent {
        constructor(view, sequence, children, context) {
            this.view = view;
            this.sequence = sequence;
            this.children = children;
            this.context = context;
            context.designerState?.selectedNode.subscribe((data) => {
                if (data && data === this) {
                    if (this.view.setSelected) {
                        this.view.setSelected(true);
                    }
                }
                else {
                    if (this.view.setSelected) {
                        this.view.setSelected(false);
                    }
                }
            });
        }
        findByClick(click) {
            // Check children
            const child = this.sequence.findByClick(click);
            if (child) {
                return child;
            }
            // If no children check if is current view
            const viewContains = this.view.element.contains(click.target);
            if (viewContains) {
                return this;
            }
            return null;
        }
    }

    class ParentView {
        constructor(element, parent, width, height, joinX, sequence) {
            this.element = element;
            this.parent = parent;
            this.width = width;
            this.height = height;
            this.joinX = joinX;
            this.sequence = sequence;
        }
    }

    var img = "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' height='48' width='48'%3e%3cpath d='M8.45 40.75V37.2h5.25l-.25-.25q-3.25-2.8-4.825-5.875Q7.05 28 7.05 24.15q0-5.9 3.725-10.475Q14.5 9.1 20.3 7.65v4.8q-3.8 1.15-6.15 4.425-2.35 3.275-2.35 7.275 0 2.95 1.1 5.1 1.1 2.15 3 3.75l1.2.75V28.5h3.55v12.25Zm19.3-.35v-4.85q3.85-1.15 6.15-4.425 2.3-3.275 2.3-7.275 0-2.2-1.125-4.5t-2.825-4.1l-1.15-1v5.25h-3.6V7.25h12.25v3.55H34.4l.3.35q3.1 2.9 4.675 6.25 1.575 3.35 1.575 6.45 0 5.9-3.7 10.5t-9.5 6.05Z'/%3e%3c/svg%3e";

    class MapView extends ParentView {
        static async create(parent, node, context) {
            const props = node.props;
            const nodes = props?.children ? props.children : [];
            const element = DomHelper.svg('g', {
                class: "map sequence nodes",
            });
            element.classList.add(...getNodeClasses(node));
            const stepView = await StepView.create(node, context);
            const mapLabelWidth = stepView.width;
            const mapLabelHeight = stepView.height;
            const sequenceGroup = DomHelper.svg('g', {
                class: "map-children-wrapper",
            });
            const mapLabelIcon = DomHelper.svg('g', {
                class: "map-label-icon",
            });
            mapLabelIcon.appendChild(DomHelper.svg('circle', {
                r: 12,
                cx: mapLabelWidth / 2,
                cy: mapLabelHeight + 2,
                class: 'circle-label-icon',
                'stroke-width': 1.25,
            }));
            const iconSize = 20;
            mapLabelIcon.appendChild(DomHelper.svg('image', {
                href: img,
                width: iconSize,
                height: iconSize,
                x: mapLabelWidth / 2 - iconSize / 2,
                y: mapLabelHeight + 2 - iconSize / 2,
            }));
            stepView.element.appendChild(mapLabelIcon);
            const childrenContainer = DomHelper.svg('g', {
                class: "children-container",
            });
            const childrenContainerBg = DomHelper.svg('rect', {
                class: "children-container-bg",
                rx: 6,
            });
            childrenContainer.appendChild(childrenContainerBg);
            sequenceGroup.appendChild(childrenContainer);
            element.appendChild(sequenceGroup);
            element.appendChild(stepView.element);
            parent.appendChild(element);
            // Create sequence
            const sequenceViewTopOffset = mapLabelHeight + PlaceholderView.height;
            const sequenceComponent = await Sequence.create(nodes, node, childrenContainer, context);
            const totalHeight = mapLabelHeight + sequenceComponent.view.height + sequenceViewTopOffset;
            const childrenContainerBgLeftOffset = 30;
            const childrenContainerBgTopOffset = 10;
            let childrenContainerBgWidth = mapLabelWidth;
            if (sequenceComponent.view.width > childrenContainerBgWidth) {
                childrenContainerBgWidth = sequenceComponent.view.width;
            }
            childrenContainerBgWidth = childrenContainerBgWidth + childrenContainerBgLeftOffset;
            childrenContainerBg.setAttribute('width', `${childrenContainerBgWidth}px`);
            childrenContainerBg.setAttribute('height', `${totalHeight - childrenContainerBgTopOffset}px`);
            // Create join line between label and sequence
            let sequenceOffsetLeft = childrenContainerBgLeftOffset;
            if (nodes.length) {
                JoinView.createConnectionJoin(childrenContainer, { x: childrenContainerBgWidth / 2, y: mapLabelHeight }, PlaceholderView.height, context);
            }
            else {
                element.classList.add('has-error');
                sequenceOffsetLeft = childrenContainerBgWidth;
            }
            const joinX = childrenContainerBgWidth / 2;
            // Output connection dot
            const endConnection = DomHelper.svg('circle', {
                r: 6,
                cx: joinX,
                cy: totalHeight,
                class: 'output',
                fill: "black",
                stroke: "black",
            });
            childrenContainer.appendChild(endConnection);
            DomHelper.translate(stepView.element, (childrenContainerBgWidth - mapLabelWidth) / 2, 0);
            DomHelper.translate(childrenContainerBg, 0, childrenContainerBgTopOffset);
            DomHelper.translate(sequenceComponent.view.element, (sequenceOffsetLeft / 2), sequenceViewTopOffset);
            const mapView = new MapView(element, parent, childrenContainerBgWidth, totalHeight, joinX, sequenceComponent);
            return mapView;
        }
        setDragging(value) {
            if (value) {
                this.element.classList.add('dragging');
            }
            else {
                this.element.classList.remove('dragging');
            }
        }
        setSelected(status) {
            if (status) {
                this.element.classList.add('selected');
            }
            else {
                this.element.classList.remove('selected');
            }
        }
    }

    class Map extends ParentComponent {
        static async create(parentElement, node, parentNode, context) {
            if (!node.props) {
                node.props = {};
            }
            const props = node.props;
            if (!props.children) {
                props.children = [];
            }
            const view = await MapView.create(parentElement, node, context);
            const mapComponent = new Map(view, view.sequence, props.children, context);
            mapComponent.node = node;
            mapComponent.parentNode = parentNode;
            return mapComponent;
        }
    }

    class TaskView {
        constructor(element, width, height, joinX) {
            this.element = element;
            this.width = width;
            this.height = height;
            this.joinX = joinX;
        }
        static async create(parent, node, context) {
            const element = DomHelper.svg('g', {
                class: "task",
            });
            element.classList.add(...getNodeClasses(node));
            const stepView = await StepView.create(node, context);
            element.appendChild(stepView.element);
            parent.appendChild(element);
            return new TaskView(element, stepView.width, stepView.height, stepView.width / 2);
        }
        setDragging(value) {
            if (value) {
                this.element.classList.add('dragging');
            }
            else {
                this.element.classList.remove('dragging');
            }
        }
        setSelected(status) {
            if (status) {
                this.element.classList.add('selected');
            }
            else {
                this.element.classList.remove('selected');
            }
        }
    }

    class Task extends ChildlessComponent {
        static async create(parentElement, node, parentNode, context) {
            const view = await TaskView.create(parentElement, node, context);
            const task = new Task(view, context);
            task.node = node;
            task.parentNode = parentNode;
            return task;
        }
    }

    class ComponentCreator {
        static async createComponent(node, parentNode, parentElement, context) {
            switch (node.type) {
                case 'task':
                    return await Task.create(parentElement, node, parentNode, context);
                case 'map':
                    return await Map.create(parentElement, node, parentNode, context);
                case 'choice':
                    return await Choice.create(parentElement, node, parentNode, context);
            }
            return null;
        }
    }

    class Placeholder {
        constructor(view, context, index) {
            this.view = view;
            this.context = context;
            this.index = index;
        }
        findByClick(click) {
            return null;
        }
        static create(parent, context, index) {
            const view = PlaceholderView.create(parent);
            const placeholder = new Placeholder(view, context, index);
            context.designerState.placeholders?.push(placeholder);
            return placeholder;
        }
        show() {
            this.view.showPlaceholder();
        }
        hide() {
            this.view.hidePlaceholder();
        }
        setIsHover(value) {
            this.view.toggleHover(value);
        }
    }

    class SequenceView {
        constructor(element, parent, nodes, width, height, joinX, componentInstances, context, placeholders) {
            this.element = element;
            this.parent = parent;
            this.nodes = nodes;
            this.width = width;
            this.height = height;
            this.joinX = joinX;
            this.componentInstances = componentInstances;
            this.context = context;
            this.placeholders = placeholders;
        }
        static async create(parentElement, nodes, parentNode, context) {
            const element = DomHelper.svg('g', {
                class: "sequence nodes",
            });
            let maxWidth = 0;
            let maxJoinX = 0;
            const components = [];
            for (const node of nodes) {
                const component = await ComponentCreator.createComponent(node, parentNode, element, context);
                if (!component)
                    continue;
                if (component.view.width > maxWidth) {
                    maxWidth = component.view.width;
                }
                if (component.view.joinX > maxJoinX) {
                    maxJoinX = component.view.joinX;
                }
                components.push(component);
            }
            const placeholders = [];
            let placeholder;
            // Create first placeholder
            placeholder = Placeholder.create(element, context, 0);
            placeholders.push(placeholder);
            let offsetX = maxJoinX - PlaceholderView.width / 2;
            if (!maxJoinX && !parentNode) {
                // The sequence is empty and this is the only placeholder
                offsetX = 0;
            }
            DomHelper.translate(placeholder.view.element, offsetX, -PlaceholderView.height);
            let sequenceHeight = 0;
            let lastTaskOffsetY = 0;
            for (let i = 0; i < components.length; i++) {
                const component = components[i];
                const nodeView = component.view;
                const offsetX = maxJoinX - component.view.joinX;
                // Center component
                DomHelper.translate(nodeView.element, offsetX, sequenceHeight);
                // Add join to previous element
                JoinView.createConnectionJoin(element, { x: maxJoinX, y: lastTaskOffsetY }, sequenceHeight - lastTaskOffsetY, context);
                sequenceHeight = sequenceHeight + nodeView.height;
                lastTaskOffsetY = sequenceHeight;
                placeholder = Placeholder.create(element, context, i + 1);
                placeholders.push(placeholder);
                DomHelper.translate(placeholder.view.element, maxJoinX - PlaceholderView.width / 2, sequenceHeight);
                sequenceHeight = sequenceHeight + placeholder.view.height;
            }
            parentElement.appendChild(element);
            return new SequenceView(element, parentElement, nodes, maxWidth, sequenceHeight, maxJoinX, components, context, placeholders);
        }
    }

    class Sequence {
        constructor(view, context, nodes) {
            this.view = view;
            this.context = context;
            this.nodes = nodes;
            for (const component of view.componentInstances) {
                component.parentSequence = this;
            }
        }
        static async create(sequenceNodes, parentNode, parentElement, context) {
            const view = await SequenceView.create(parentElement, sequenceNodes, parentNode, context);
            const sequence = new Sequence(view, context, sequenceNodes);
            // Update view placeholders
            for (const placeholder of view.placeholders) {
                placeholder.parentSequence = sequence;
            }
            return sequence;
        }
        findByClick(click) {
            for (const componentInstance of this.view.componentInstances) {
                const element = componentInstance.findByClick(click);
                if (element) {
                    return element;
                }
            }
            return null;
        }
        getNodeIndex(node) {
            const id = node.id;
            return this.nodes.findIndex(e => e.id === id);
        }
    }

    class StartView {
        constructor(element, parent, width, height, joinX) {
            this.element = element;
            this.parent = parent;
            this.width = width;
            this.height = height;
            this.joinX = joinX;
        }
        static create(parent, context) {
            const diameter = 60;
            const radius = diameter / 2;
            const element = DomHelper.svg('g', {
                class: "start",
            });
            const circle = DomHelper.svg('circle', {
                class: "start-bg",
                "stroke-width": 1,
                r: radius,
                cx: 0,
                cy: radius,
            });
            const label = LabelView.create('Start', context);
            DomHelper.translate(label.element, 0, radius);
            parent.appendChild(element);
            element.appendChild(circle);
            element.appendChild(label.element);
            return new StartView(element, parent, diameter, diameter + PlaceholderView.height, diameter / 2);
        }
    }

    class Start extends ChildlessComponent {
        static create(parent, context) {
            const view = StartView.create(parent, context);
            return new Start(view, context);
        }
    }

    class WorkflowView {
        constructor(element, parent, context, width, height, joinX) {
            this.element = element;
            this.parent = parent;
            this.context = context;
            this.width = width;
            this.height = height;
            this.joinX = joinX;
        }
        static async create(parent, context) {
            const svg = DomHelper.svg('svg', {
                class: "workflow-root",
                width: '100%',
                height: '100%',
            });
            // Append svg defs        
            WorkflowView._addSvgDefs(svg);
            const workflowWrapper = DomHelper.svg('g', {
                class: "workflow-wrapper",
                fill: "transparent",
            });
            const start = Start.create(workflowWrapper, context);
            let maxJoinX = start.view.joinX;
            const nodes = context.tree;
            const sequence = await Sequence.create(nodes, null, workflowWrapper, context);
            const sequenceCenter = sequence.view.joinX;
            if (sequenceCenter > maxJoinX) {
                maxJoinX = sequenceCenter;
            }
            let totalHeight = start.view.height + sequence.view.height;
            const end = End.create(workflowWrapper, context);
            // Add join to start element
            JoinView.createConnectionJoin(workflowWrapper, { x: maxJoinX, y: start.view.height - PlaceholderView.height }, PlaceholderView.height, context);
            // Add last join
            JoinView.createConnectionJoin(workflowWrapper, { x: maxJoinX, y: totalHeight - PlaceholderView.height }, PlaceholderView.height, context);
            DomHelper.translate(sequence.view.element, 0, start.view.height);
            // Center start and stop
            DomHelper.translate(start.view.element, maxJoinX, 0);
            DomHelper.translate(end.view.element, maxJoinX, totalHeight);
            const workflowOffsetY = 10;
            totalHeight = totalHeight + end.view.height + workflowOffsetY;
            svg.appendChild(workflowWrapper);
            parent.appendChild(svg);
            const workflowView = new WorkflowView(svg, parent, context, workflowWrapper.clientWidth, totalHeight, maxJoinX);
            workflowView.mainSequence = sequence;
            workflowView.wrapper = workflowWrapper;
            if (!context.designerState.workspacePosition) {
                workflowView.fitAndCenter();
            }
            else {
                const workflowPosition = context.designerState.workspacePosition;
                const zoomLevel = context.designerState.zoomLevel;
                workflowWrapper.setAttribute('transform', `translate(${workflowPosition.x}, ${workflowPosition.y}) scale(${zoomLevel})`);
            }
            return workflowView;
        }
        findComponentByClick(click) {
            return this.mainSequence.findByClick(click);
        }
        // Center workflowWrapper into svg
        fitAndCenter() {
            const parentRect = this.parent.getBoundingClientRect();
            const workflowOffsetY = 10;
            let zoomLevel = this.context.designerState.zoomLevel;
            const parentHeight = parentRect.height - workflowOffsetY;
            if (this.height > parentHeight) {
                // We have to scale the workflow because it's too big
                zoomLevel = (parentHeight / this.height);
            }
            const workflowOffsetX = (parentRect.width / 2) - (this.joinX * zoomLevel);
            let workflowPosition = {
                x: workflowOffsetX,
                y: workflowOffsetY,
            };
            this.context.designerState.zoomLevel = zoomLevel;
            this.context.designerState.workspacePosition = workflowPosition;
            this.wrapper.setAttribute('transform', `translate(${workflowPosition.x}, ${workflowPosition.y}) scale(${zoomLevel})`);
        }
        static _addSvgDefs(svg) {
            const marker = DomHelper.svg('marker', {
                id: "arrowEnd",
                refX: "10",
                refY: "5",
                viewBox: '0 0 10 10',
                markerUnits: "strokeWidth",
                markerWidth: "6",
                markerHeight: "6",
                orient: "auto",
            });
            marker.appendChild(DomHelper.svg('path', {
                d: "M 0 0 L 10 5 L 0 10 z",
                fill: "currentColor",
            }));
            const defs = DomHelper.svg('defs');
            defs.appendChild(marker);
            svg.appendChild(defs);
        }
    }

    class Workflow {
        constructor(view, context) {
            this.view = view;
            this.context = context;
        }
        findByClick(click) {
            return this.view.findComponentByClick(click);
        }
        static async create(parent, context) {
            const view = await WorkflowView.create(parent, context);
            return new Workflow(view, context);
        }
    }

    class WorkspaceView {
        constructor(element, parent, context) {
            this.element = element;
            this.parent = parent;
            this.context = context;
        }
        static async create(parent, context) {
            const workspace = DomHelper.element('div', {
                id: "workspace-root",
                class: "workspace-root",
            });
            parent.appendChild(workspace);
            Background.create(workspace);
            const workflow = await Workflow.create(workspace, context);
            const wsv = new WorkspaceView(workspace, parent, context);
            wsv.workflow = workflow;
            return wsv;
        }
        bindClick(handler) {
            this.element.addEventListener('mousedown', (e) => {
                e.preventDefault();
                handler(readMousePosition(e), e.target, buttonIndexToType(e.button));
            }, false);
        }
        bindContextMenu(handler) {
            this.element.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                handler(readMousePosition(e), e.target);
            }, false);
        }
        bindWheel(handler) {
            this.element.addEventListener("wheel", handler, false);
        }
        bindKeyboard(handler) {
            window.addEventListener('keydown', handler, false);
            window.addEventListener('keyup', handler, false);
        }
    }

    class Observable {
        constructor(data) {
            this._observers = [];
            this._data = data;
        }
        next(data) {
            this._data = data;
            for (const observer of this._observers) {
                observer(this._data);
            }
        }
        subscribe(observerFunction) {
            this._observers.push(observerFunction);
        }
        getValue() {
            return this._data;
        }
    }

    class WorkflowMoveInteraction {
        constructor(workflow, context) {
            this.workflow = workflow;
            this.context = context;
        }
        static create(workflow, context) {
            const interaction = new WorkflowMoveInteraction(workflow, context);
            interaction._workflowWrapper = workflow.view.wrapper;
            return interaction;
        }
        onStart(position) {
            this._startPosition = position;
            // Calculate offset from current mouse click position and the component
            const componentClientRect = this._workflowWrapper.getBoundingClientRect();
            const relativeClickPosition = subtract(this._startPosition, {
                x: componentClientRect.x,
                y: componentClientRect.y,
            });
            this._mouseClickOffsetFromComponent = relativeClickPosition;
            this.workflow.view.element.classList.add('moving');
        }
        onMove(delta) {
            const workflowRect = this.workflow.view.element.getBoundingClientRect();
            let workflowPosition = subtract(this._startPosition, delta);
            // Compensate the workflow view translation
            workflowPosition = subtract(workflowPosition, {
                x: workflowRect.left,
                y: workflowRect.top,
            });
            workflowPosition = subtract(workflowPosition, this._mouseClickOffsetFromComponent);
            const zoomLevel = this.context.designerState.zoomLevel;
            this._workflowWrapper.setAttribute('transform', `translate(${workflowPosition?.x ? workflowPosition.x : 0}, ${workflowPosition?.y ? workflowPosition.y : 0}) scale(${zoomLevel})`);
            this.context.designerState.workspacePosition = workflowPosition;
        }
        onEnd() {
            this.workflow.view.element.classList.remove('moving');
        }
    }

    class WorkflowScaleInteraction {
        constructor(workflow, context) {
            this.workflow = workflow;
            this.context = context;
            this._minZoomLevel = 0.05;
            this._maxZoomLevel = 2;
            this._zoomStep = 0.05;
        }
        static create(workflow, context) {
            const interaction = new WorkflowScaleInteraction(workflow, context);
            interaction._workflowWrapper = workflow.view.wrapper;
            return interaction;
        }
        onWheel(delta) {
            let zoomLevel = this.context.designerState?.zoomLevel ? this.context.designerState.zoomLevel : 1;
            if (delta > 0) {
                // Scroll down
                zoomLevel = zoomLevel - this._zoomStep;
                if (zoomLevel < this._minZoomLevel) {
                    zoomLevel = this._minZoomLevel;
                }
            }
            else {
                // Scroll up
                zoomLevel = zoomLevel + this._zoomStep;
                if (zoomLevel > this._maxZoomLevel) {
                    zoomLevel = this._maxZoomLevel;
                }
            }
            const workflowPosition = this.context.designerState.workspacePosition;
            const positionX = workflowPosition?.x ? workflowPosition.x : 0;
            const positionY = workflowPosition?.y ? workflowPosition.y : 0;
            this._workflowWrapper.setAttribute('transform', `translate(${positionX}, ${positionY}) scale(${zoomLevel})`);
            this.context.designerState.zoomLevel = zoomLevel;
        }
    }

    class DragExternalInteraction {
        constructor(element, context, placeholderFinder) {
            this.element = element;
            this.context = context;
            this.placeholderFinder = placeholderFinder;
            this._currentPlaceholder = null;
        }
        static create(element, context) {
            const placeholderFinder = PlaceholderFinder.create(context.designerState?.placeholders ? context.designerState.placeholders : []);
            return new DragExternalInteraction(element, context, placeholderFinder);
        }
        onStart(startMousePosition) {
            this._startPosition = startMousePosition;
            const componentPosition = getElementPositionInWorkspace(this.element, this.context);
            this._mouseClickOffsetFromComponent = subtract(startMousePosition, {
                x: componentPosition.x,
                y: componentPosition.y,
            });
            if (this.context.designerState.placeholders) {
                for (const placeholder of this.context.designerState.placeholders) {
                    placeholder.show();
                }
            }
        }
        onMove(delta) {
            let newPosition = subtract(this._startPosition, delta);
            newPosition = subtract(newPosition, this._mouseClickOffsetFromComponent);
            const elementRect = this.element.getBoundingClientRect();
            const placeholder = this.placeholderFinder.findByPosition(newPosition, elementRect.width, elementRect.height);
            // This is a workaround for the dragend event because when you are dragging an HtmlElement and you release the mouse a last drag event is emitted before dragend and it could override the placeholder value.
            setTimeout(() => {
                if (placeholder) {
                    if (this._currentPlaceholder) {
                        this._currentPlaceholder.setIsHover(false);
                        this._currentPlaceholder = placeholder;
                    }
                    else {
                        this._currentPlaceholder = placeholder;
                    }
                    this._currentPlaceholder.setIsHover(true);
                }
                else {
                    if (this._currentPlaceholder) {
                        this._currentPlaceholder.setIsHover(false);
                    }
                    this._currentPlaceholder = null;
                }
            });
        }
        onEnd() {
            const currentPlaceholder = this._currentPlaceholder;
            const tempNodeToDrop = this.context.designerState.tempNodeToDrop;
            if (currentPlaceholder && tempNodeToDrop) {
                const canDropNodeFn = this.context.userDefinedListeners?.canDropNode;
                if (canDropNodeFn) {
                    const event = {
                        node: tempNodeToDrop,
                        parent: null,
                        action: "add",
                    };
                    canDropNodeFn(event).then((result) => {
                        if (result === true) {
                            this._dropNode(currentPlaceholder, tempNodeToDrop);
                        }
                    });
                }
                else {
                    this._dropNode(currentPlaceholder, tempNodeToDrop);
                }
            }
            if (this.context.designerState.placeholders) {
                for (const placeholder of this.context.designerState.placeholders) {
                    placeholder.hide();
                }
            }
        }
        _dropNode(placeholder, node) {
            const targetSequence = placeholder.parentSequence;
            SequenceModifier.add(targetSequence, {
                node: node,
                parentNode: null,
            }, placeholder.index);
        }
    }

    function spacebarKey(event) {
        return event.code === 'Space' || event.keyCode === 32;
    }
    function delKey(event) {
        return event.code === 'Delete' || event.keyCode === 46;
    }

    class DeleteKeyInteraction {
        constructor(context) {
            this.context = context;
        }
        static create(context) {
            return new DeleteKeyInteraction(context);
        }
        onPress(e) {
            if (!delKey(e))
                return;
            const componentInstance = this.context.designerState.selectedNode.getValue();
            if (!componentInstance)
                return;
            removeNode(componentInstance, this.context);
        }
        onRelease(e) {
            // NOOP
        }
    }

    class CtrlInteraction {
        constructor(workflow, context) {
            this.workflow = workflow;
            this.context = context;
        }
        static create(workflow, context) {
            return new CtrlInteraction(workflow, context);
        }
        onPress(e) {
            this.context.designerState.isPressingCtrl = true;
            this.workflow.view.element.classList.add('moving');
        }
        onRelease(e) {
            this.context.designerState.isPressingCtrl = false;
            this.workflow.view.element.classList.remove('moving');
        }
    }

    class ContextMenuView {
        constructor(element, items) {
            this.element = element;
            this.items = items;
        }
        static create(position, items, context) {
            const contextMenuElement = DomHelper.element('div', {
                class: "context-menu",
            });
            contextMenuElement.style.position = 'absolute';
            const realPosition = getVectorPositionInWorkspace(position, context);
            contextMenuElement.style.left = realPosition.x + 'px';
            contextMenuElement.style.top = realPosition.y + 'px';
            const contextMenu = new ContextMenuView(contextMenuElement, items);
            const contextMenuItems = DomHelper.element('ul', {
                class: 'context-menu-items',
            });
            for (const item of items) {
                const menuItem = ContextMenuView._createMenuItem(item.label);
                contextMenuItems.append(menuItem);
                menuItem.addEventListener('mousedown', (e) => item.action(e), false);
            }
            contextMenuElement.append(contextMenuItems);
            return contextMenu;
        }
        static _createMenuItem(label) {
            const item = DomHelper.element('li', {
                class: "context-menu-item",
            });
            item.append(label);
            return item;
        }
    }

    class ComponentContextMenuView {
        constructor() { }
        static create(position, context, onRemoveAction, onDuplicateAction) {
            const componentContextMenu = new ComponentContextMenuView();
            const items = [
                {
                    label: context.options.strings['context-menu.component.actions.remove.label'],
                    action: onRemoveAction,
                },
                {
                    label: context.options.strings['context-menu.component.actions.duplicate.label'],
                    action: onDuplicateAction,
                }
            ];
            const contextMenu = ContextMenuView.create(position, items, context);
            componentContextMenu.contextMenu = contextMenu;
            return componentContextMenu;
        }
    }

    class WorkspaceContextMenuView {
        constructor() { }
        static create(position, context, onFitAndCenter) {
            const componentContextMenu = new WorkspaceContextMenuView();
            const items = [
                {
                    label: context.options.strings['context-menu.workspace.actions.fitandcenter.label'],
                    action: onFitAndCenter,
                },
            ];
            const contextMenu = ContextMenuView.create(position, items, context);
            componentContextMenu.contextMenu = contextMenu;
            return componentContextMenu;
        }
    }

    function deepMerge(target, newValues) {
        if (!isRecord(target) || !isRecord(newValues)) {
            return null;
        }
        let output = Object.assign({}, target);
        for (let key in newValues) {
            const value = newValues[key];
            if (isRecord(newValues[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: value });
                }
                else {
                    output[key] = deepMerge(target[key], value);
                }
            }
            else {
                if (Array.isArray(value)) {
                    if (!output[key]) {
                        Object.assign(output, { [key]: value });
                    }
                    const outputValue = output[key];
                    for (let i = 0; i < value.length; i++) {
                        if (outputValue[i] && isRecord(outputValue[i]) && isRecord(value[i])) {
                            outputValue[i] = deepMerge(outputValue[i], value[i]);
                        }
                        else {
                            outputValue[i] = value[i];
                        }
                    }
                }
                else {
                    Object.assign(output, { [key]: value });
                }
            }
        }
        return output;
    }
    function isRecord(value) {
        return value != null && typeof value === 'object' && Object.keys(value).length > 0 && !Array.isArray(value);
    }

    class Workspace {
        constructor(view, context, parent) {
            this.view = view;
            this.context = context;
            this.parent = parent;
            this._userInteractionController = new UserInteractionController();
            context.designerState?.selectedNode.subscribe((data) => {
                if (data && context.userDefinedListeners?.onNodeSelect) {
                    if (instanceOfComponentWithNode(data)) {
                        context.userDefinedListeners.onNodeSelect({
                            node: data.node,
                            parent: data.parentNode,
                        });
                    }
                    const deleteKeyInteraction = DeleteKeyInteraction.create(this.context);
                    this._userInteractionController.handleKeyboardInteraction(deleteKeyInteraction);
                }
            });
            context.designerState?.deselectedNode.subscribe((data) => {
                if (context.userDefinedListeners?.onNodeDeselect) {
                    if (instanceOfComponentWithNode(data)) {
                        context.userDefinedListeners.onNodeDeselect({
                            node: data.node,
                            parent: data.parentNode,
                        });
                    }
                }
            });
        }
        // Public methods
        static async init(initData) {
            const combinedOptions = deepMerge(Workspace._getDefaultOptions(), initData?.options);
            const context = {
                tree: initData.tree,
                designerState: {
                    placeholders: [],
                    selectedNode: new Observable(),
                    deselectedNode: new Observable,
                    zoomLevel: 1,
                },
                options: combinedOptions,
            };
            if (!context.userDefinedListeners) {
                context.userDefinedListeners = {};
            }
            if (initData.onNodeSelect) {
                context.userDefinedListeners.onNodeSelect = initData.onNodeSelect;
            }
            if (initData.onNodeDeselect) {
                context.userDefinedListeners.onNodeDeselect = initData.onNodeDeselect;
            }
            if (initData.onNodeRemove) {
                context.userDefinedListeners.onNodeRemove = initData.onNodeRemove;
            }
            if (initData.onTreeChange) {
                context.userDefinedListeners.onTreeChange = initData.onTreeChange;
            }
            if (initData.canRemoveNode) {
                context.userDefinedListeners.canRemoveNode = initData.canRemoveNode;
            }
            if (initData.canDropNode) {
                context.userDefinedListeners.canDropNode = initData.canDropNode;
            }
            if (!context.userDefinedOverriders) {
                context.userDefinedOverriders = {};
            }
            if (initData.overrideLabel) {
                context.userDefinedOverriders.overrideLabel = initData.overrideLabel;
            }
            if (initData.overrideIcon) {
                context.userDefinedOverriders.overrideIcon = initData.overrideIcon;
            }
            const view = await WorkspaceView.create(initData.parent, context);
            const workspace = new Workspace(view, context, initData.parent);
            workspace._setViewBinds();
            context.onDefinitionChange = workspace._onDefinitionChange.bind(workspace);
            context.designerState.workspaceRect = workspace.view.element.getBoundingClientRect();
            return workspace;
        }
        setTree(tree, preservePositionAndScale = false) {
            if (this.context.onDefinitionChange) {
                this.context.onDefinitionChange(tree, preservePositionAndScale);
            }
        }
        startDrag(element, startPosition, node) {
            this.context.designerState.tempNodeToDrop = node;
            const dragDropInteraction = DragExternalInteraction.create(element, this.context);
            this._userInteractionController.handleDragInteraction(dragDropInteraction, startPosition);
        }
        fitAndCenter() {
            this.view.workflow.view.fitAndCenter();
        }
        _setViewBinds() {
            this.view.bindClick((position, target, button) => this._onClick(position, target, button));
            this.view.bindWheel((e) => this._onWheel(e));
            this.view.bindContextMenu((position, target) => this._onContextMenu(position, target));
            this.view.bindKeyboard((e) => this._onKeyboard(e));
        }
        async _onDefinitionChange(tree, preservePositionAndScale = false) {
            this.context.tree = tree;
            if (!preservePositionAndScale) {
                this.context.designerState.workspacePosition = undefined;
                this.context.designerState.zoomLevel = 1;
            }
            this.parent.removeChild(this.view.element);
            const view = await WorkspaceView.create(this.parent, this.context);
            this.view = view;
            this._setViewBinds();
            if (this.context.userDefinedListeners?.onTreeChange) {
                this.context.userDefinedListeners.onTreeChange({
                    tree: this.context.tree,
                });
            }
        }
        _onClick(position, target, button) {
            this._clearContextMenus();
            if (button === MouseButton.LEFT || button === MouseButton.MIDDLE) {
                const workflow = this.view.workflow;
                const click = {
                    position: position,
                    target: target,
                };
                let componentInstance;
                if (!this.context.designerState.isPressingCtrl) {
                    componentInstance = workflow.findByClick(click);
                    if (componentInstance) {
                        this.context.designerState?.selectedNode.next(componentInstance);
                    }
                    else {
                        const previousSelectedNode = this.context.designerState?.selectedNode.getValue();
                        if (previousSelectedNode) {
                            this.context.designerState?.deselectedNode.next(previousSelectedNode);
                            this.context.designerState.selectedNode.next(null);
                        }
                    }
                }
                let userInteraction;
                if (componentInstance && !this.context.designerState.isPressingCtrl) {
                    userInteraction = SelectComponentInteraction.create(componentInstance, this.context);
                }
                else {
                    userInteraction = WorkflowMoveInteraction.create(workflow, this.context);
                }
                this._userInteractionController.handleClickInteraction(userInteraction, position);
            }
        }
        _onContextMenu(position, target) {
            this._clearContextMenus();
            const workflow = this.view.workflow;
            const click = {
                position: position,
                target: target,
            };
            const componentInstance = workflow.findByClick(click);
            let contextMenu;
            if (componentInstance) {
                this.context.designerState?.selectedNode.next(componentInstance);
                contextMenu = ComponentContextMenuView.create(position, this.context, (e) => this._onContextMenuRemoveAction(e, componentInstance), (e) => this._onContextMenuDuplicateAction(e, componentInstance));
            }
            else {
                this.context.designerState?.selectedNode.next(null);
                contextMenu = WorkspaceContextMenuView.create(position, this.context, (e) => this._onContextMenuFitAndCenter(e));
            }
            if (contextMenu) {
                this.view.element.appendChild(contextMenu.contextMenu.element);
            }
        }
        _onWheel(e) {
            e.preventDefault();
            const userInteraction = WorkflowScaleInteraction.create(this.view.workflow, this.context);
            this._userInteractionController.handleWheelInteraction(userInteraction, e);
        }
        _onKeyboard(e) {
            if (e.ctrlKey || spacebarKey(e)) {
                const interaction = CtrlInteraction.create(this.view.workflow, this.context);
                this._userInteractionController.handleKeyboardInteraction(interaction);
            }
        }
        _clearContextMenus() {
            const contextMenus = document.body.querySelectorAll('.context-menu');
            contextMenus.forEach(e => {
                e.remove();
            });
        }
        _onContextMenuRemoveAction(e, componentInstance) {
            e.preventDefault();
            removeNode(componentInstance, this.context);
        }
        _onContextMenuDuplicateAction(e, componentInstance) {
            e.preventDefault();
            duplicateNode(componentInstance);
        }
        _onContextMenuFitAndCenter(e) {
            e.preventDefault();
            this.fitAndCenter();
        }
        static _getDefaultOptions() {
            return {
                style: {
                    fontSize: "1em",
                    fontFamily: 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
                },
                strings: {
                    "context-menu.component.actions.remove.label": "Remove",
                    "context-menu.component.actions.duplicate.label": "Duplicate",
                    "context-menu.workspace.actions.fitandcenter.label": "Fit and center"
                }
            };
        }
    }

    async function init(options) {
        return Workspace.init(options);
    }

    exports.Workspace = Workspace;
    exports.init = init;

}));
