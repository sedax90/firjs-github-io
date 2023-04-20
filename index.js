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
    function instanceOfComponentInstance(value) {
        if (typeof value !== 'object')
            return false;
        return 'view' in value && 'context' in value && 'parentSequence' in value;
    }

    class PlaceholderFinder {
        constructor(placeholders) {
            this.placeholders = placeholders;
            this._cache = [];
        }
        static getInstance() {
            if (!PlaceholderFinder._instance) {
                PlaceholderFinder._instance = new PlaceholderFinder([]);
            }
            return PlaceholderFinder._instance;
        }
        buildCache(placeholders) {
            this.placeholders = placeholders;
            this._cache = [];
            this.recalculatePositions();
        }
        recalculatePositions() {
            for (const placeholder of this.placeholders) {
                const position = getComponentPositionInWorkspace(placeholder);
                this._cache.push({
                    placeholder,
                    letTopPosition: { x: position.x, y: position.y },
                    bottomRightPosition: { x: position.x + placeholder.view.width, y: position.y + placeholder.view.height }
                });
            }
            this._cache.sort((a, b) => a.letTopPosition.y - b.letTopPosition.y);
        }
        findByPosition(mousePosition, componentWidth, componentHeight) {
            const vR = mousePosition.x + componentWidth;
            const vB = mousePosition.y + componentHeight;
            for (const cacheItem of this._cache) {
                if (Math.max(mousePosition.x, cacheItem.letTopPosition.x) < Math.min(vR, cacheItem.bottomRightPosition.x) && Math.max(mousePosition.y, cacheItem.letTopPosition.y) < Math.min(vB, cacheItem.bottomRightPosition.y)) {
                    return cacheItem.placeholder;
                }
            }
            return null;
        }
    }

    class EventSuppressor {
        constructor() {
            this._events = new Set();
        }
        static getInstance() {
            if (!EventSuppressor._instance) {
                this._instance = new EventSuppressor();
            }
            return this._instance;
        }
        suppress(event) {
            this._events.add(event);
        }
        contains(event) {
            return this._events.has(event);
        }
        release(event) {
            this._events.delete(event);
        }
    }

    class EventEmitter {
        static emitTreeChangeEvent(element, data) {
            if (EventEmitter._suppressEvent('treeChange'))
                return;
            element.dispatchEvent(EventEmitter.createCustomEvent("treeChange", data));
        }
        static emitNodeMoveEvent(element, data) {
            if (EventEmitter._suppressEvent('nodeMove'))
                return;
            element.dispatchEvent(EventEmitter.createCustomEvent("nodeMove", data));
        }
        static emitNodeAddEvent(element, data) {
            if (EventEmitter._suppressEvent('nodeAdd'))
                return;
            element.dispatchEvent(EventEmitter.createCustomEvent('nodeAdd', data));
        }
        static emitNodeRemoveEvent(element, data) {
            if (EventEmitter._suppressEvent('nodeRemove'))
                return;
            element.dispatchEvent(EventEmitter.createCustomEvent('nodeRemove', data));
        }
        static emitWorkflowPanEvent(element, data) {
            if (EventEmitter._suppressEvent('workflowPan'))
                return;
            element.dispatchEvent(EventEmitter.createCustomEvent('workflowPan', data));
        }
        static emitWorkflowScaleEvent(element, data) {
            if (EventEmitter._suppressEvent('workflowScale'))
                return;
            element.dispatchEvent(EventEmitter.createCustomEvent('workflowScale', data));
        }
        static emitNodeSelectEvent(element, data) {
            if (EventEmitter._suppressEvent('nodeSelect'))
                return;
            element.dispatchEvent(EventEmitter.createCustomEvent('nodeSelect', data));
        }
        static emitNodeDeselectEvent(element, data) {
            if (EventEmitter._suppressEvent('nodeDeselect'))
                return;
            element.dispatchEvent(EventEmitter.createCustomEvent('nodeDeselect', data));
        }
        static emitFlowModeChangeEvent(element, data) {
            if (EventEmitter._suppressEvent('flowModeChange'))
                return;
            element.dispatchEvent(EventEmitter.createCustomEvent('flowModeChange', data));
        }
        static createCustomEvent(name, data) {
            return new CustomEvent(name, {
                detail: data,
                bubbles: true,
                composed: true,
                cancelable: true,
            });
        }
        static _suppressEvent(event) {
            const eventSuppressor = EventSuppressor.getInstance();
            const suppressed = eventSuppressor.contains(event);
            eventSuppressor.release(event);
            return suppressed;
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
            if (isSameSequence) {
                if (sourceIndex === targetIndex || sourceIndex + 1 === targetIndex) {
                    return; // Nothing to do.
                }
            }
            sourceSequence.nodes.splice(sourceIndex, 1);
            if (isSameSequence && sourceIndex < targetIndex) {
                targetIndex--;
            }
            targetSequence.nodes.splice(targetIndex, 0, node);
            EventEmitter.emitNodeMoveEvent(targetSequence.view.element, {
                node: component.node,
                parent: component.parentNode,
                previousParent: sourceSequence.parentNode,
                previousIndex: sourceIndex,
                currentIndex: targetIndex,
            });
        }
        static add(sequence, component, index) {
            sequence.nodes.splice(index, 0, component.node);
            EventEmitter.emitNodeAddEvent(sequence.view.element, {
                node: component.node,
                parent: component.parentNode,
                index: instanceOfComponentInstance(component) ? component.indexInSequence : null,
            });
        }
        static remove(sequence, component) {
            const index = sequence.nodes.findIndex(e => e.id === component.node.id);
            sequence.nodes.splice(index, 1);
            EventEmitter.emitNodeRemoveEvent(sequence.view.element, {
                node: component.node,
                parent: sequence.parentNode,
                index: instanceOfComponentInstance(component) ? component.indexInSequence : -1,
            });
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
            const zoomLevel = context.designerState.scale;
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
            this._dragEnded = false;
        }
        static create(componentInstance, context) {
            const dragView = DragView.create(componentInstance, context);
            const placeholderFinder = PlaceholderFinder.getInstance();
            return new MoveComponentInteraction(dragView, componentInstance, placeholderFinder, context);
        }
        onStart(startMousePosition) {
            this.context.designerState.wasMoving = true;
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
            this.context.designerState.selectedPlaceholder.next(placeholder);
        }
        onEnd() {
            if (this._dragEnded)
                return;
            const currentPlaceholder = this.context.designerState.selectedPlaceholder.getValue();
            if (currentPlaceholder && currentPlaceholder.canDrop && instanceOfComponentWithNode(this.draggedComponent)) {
                const sourceSequence = this.draggedComponent.parentSequence;
                const targetSequence = currentPlaceholder.parentSequence;
                // Check if we are going to put a sequence inside a child of it
                if (this.draggedComponent.view.element.contains(targetSequence.view.element)) {
                    this._terminateDrag();
                    return;
                }
                if (sourceSequence && targetSequence) {
                    const canAttachNodeFn = this.context.userDefinedFunctions?.canAttachNode;
                    const currentPlaceholderIndex = currentPlaceholder.indexInSequence;
                    const draggedComponent = this.draggedComponent;
                    if (canAttachNodeFn) {
                        canAttachNodeFn({
                            node: this.draggedComponent.node,
                            parent: this.draggedComponent.parentNode,
                            action: "move",
                            index: this.draggedComponent.indexInSequence,
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
            this.context.designerState.selectedPlaceholder.next(null);
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
                startPosition: startPosition,
            };
            interaction.onStart(startPosition);
            window.addEventListener('mousemove', this._onMouseMoveHandler, false);
            window.addEventListener('mouseup', this._onMouseUpHandler, false);
        }
        handleWheelInteraction(interaction, event) {
            interaction.onWheel(event.deltaY, readMousePosition(event));
        }
        handleDragInteraction(userInteraction, startPosition) {
            this._clickInteractionState = {
                userInteraction: userInteraction,
                startPosition: startPosition,
            };
            userInteraction.onStart(startPosition);
            // We must listen on draover event because Firefox doens't emit mouse coordinates on drag event (https://bugzilla.mozilla.org/show_bug.cgi?id=505521)
            window.addEventListener('dragover', this._onMouseMoveHandler, false);
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
            context.designerState?.selectedComponent.subscribe((data) => {
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
            const viewContains = this.view.getSelectableElement()?.contains(click.target);
            if (viewContains) {
                return this;
            }
            return null;
        }
        findById(nodeId) {
            if (this.node && this.node.id === nodeId)
                return this;
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
        constructor(element, parent, width, height, joinX, joinY) {
            this.element = element;
            this.parent = parent;
            this.width = width;
            this.height = height;
            this.joinX = joinX;
            this.joinY = joinY;
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
                cx: radius,
                cy: radius,
            });
            const label = LabelView.create('End', context);
            DomHelper.translate(label.element, radius, radius);
            parent.appendChild(element);
            element.appendChild(circle);
            element.appendChild(label.element);
            return new EndView(element, parent, diameter, diameter, radius, radius);
        }
        getSelectableElement() {
            return null;
        }
    }

    class End extends ChildlessComponent {
        static create(parent, context) {
            const view = EndView.create(parent, context);
            return new End(view, context);
        }
    }

    class JoinView {
        static createVerticalStraightJoin(parent, start, height) {
            const line = DomHelper.svg('line', {
                class: "join-line",
                x1: start.x,
                y1: start.y,
                x2: start.x,
                y2: start.y + height,
            });
            parent.insertBefore(line, parent.firstChild);
            return line;
        }
        static createHorizontalStraightJoin(parent, start, width) {
            const line = DomHelper.svg('line', {
                class: "join-line",
                x1: start.x,
                y1: start.y,
                x2: start.x + width,
                y2: start.y,
            });
            parent.insertBefore(line, parent.firstChild);
            return line;
        }
        static createConnectionJoin(parent, start, dimension, context) {
            const line = (context.designerState.flowMode === 'vertical') ? JoinView.createVerticalStraightJoin(parent, start, dimension) : JoinView.createHorizontalStraightJoin(parent, start, dimension);
            if (dimension) {
                line.setAttribute("marker-end", "url(#arrowEnd)");
            }
            return line;
        }
        static createHorizontalJoins(parent, start, targets) {
            const totalTarget = targets.length;
            if (totalTarget === 0)
                return;
            for (let i = 0; i < totalTarget; i++) {
                const end = targets[i];
                const d = `M ${start.x} ${start.y} L ${end.x} ${start.y} L ${end.x} ${end.y}`;
                parent.insertBefore(DomHelper.svg('path', {
                    class: "join-line",
                    d: d,
                }), parent.firstChild);
            }
        }
        static createVerticalJoins(parent, start, targets) {
            const totalTarget = targets.length;
            if (totalTarget === 0)
                return;
            for (let i = 0; i < totalTarget; i++) {
                const end = targets[i];
                const d = `M ${start.x} ${start.y} L ${start.x} ${end.y} L ${end.x} ${end.y}`;
                parent.insertBefore(DomHelper.svg('path', {
                    class: "join-line",
                    d: d,
                }), parent.firstChild);
            }
        }
    }

    class PlaceholderLabel {
        constructor(element, width, height) {
            this.element = element;
            this.width = width;
            this.height = height;
        }
        static async create(parentElement, text, columnIndex, context) {
            const height = 20;
            const element = DomHelper.svg('g', {
                class: `placeholder-label placeholder-label-index-${columnIndex}`,
            });
            const label = LabelView.create(text, context, {
                class: [
                    'placeholder-label-text',
                ]
            });
            const labelWidth = label.textLength + 20;
            const labelOffsetX = labelWidth / 2;
            const labelOffsetY = height / 2;
            DomHelper.translate(label.element, labelOffsetX, labelOffsetY);
            const background = DomHelper.svg('rect', {
                class: 'placeholder-label-background',
                width: labelWidth,
                height: height,
                rx: 10,
            });
            element.appendChild(background);
            element.appendChild(label.element);
            parentElement.appendChild(element);
            return new PlaceholderLabel(element, labelWidth, height);
        }
    }

    const HOVER_CLASS = 'hover';
    const NOT_ALLOWED_CLASS = 'not-allowed';
    const DROPPABLE_CLASS = 'droppable';
    class PlaceholderView {
        constructor(element, index, context, width, height, joinX, joinY) {
            this.element = element;
            this.index = index;
            this.context = context;
            this.width = width;
            this.height = height;
            this.joinX = joinX;
            this.joinY = joinY;
        }
        static async create(parent, index, context) {
            const flowMode = context.designerState.flowMode;
            const placeholderWidth = context.options.style.placeholder.width;
            const placeholderHeight = context.options.style.placeholder.height;
            const element = DomHelper.svg('g', {
                class: 'placeholder-area',
                visibility: 'hidden',
            });
            parent.appendChild(element);
            const dropArea = DomHelper.svg('rect', {
                class: 'placeholder-drop-area',
                width: placeholderWidth,
                height: placeholderHeight,
            });
            element.appendChild(dropArea);
            const selector = DomHelper.svg('rect', {
                class: 'placeholder-selector',
                width: flowMode === 'vertical' ? placeholderWidth : 3,
                height: flowMode === 'vertical' ? 6 : placeholderHeight,
                x: flowMode === 'vertical' ? 0 : (placeholderWidth - 3) / 2,
                y: flowMode === 'vertical' ? (placeholderHeight - 5) / 2 : 0,
                rx: 2,
            });
            element.appendChild(selector);
            const placeholderView = new PlaceholderView(element, index, context, placeholderWidth, placeholderHeight, placeholderWidth / 2, placeholderHeight / 2);
            placeholderView._placeholderGroup = element;
            return placeholderView;
        }
        showPlaceholder() {
            this._placeholderGroup.setAttribute('visibility', 'visible');
        }
        hidePlaceholder() {
            this._placeholderGroup.setAttribute('visibility', 'hidden');
        }
        setCanDrop(canDrop) {
            this.resetCanDrop();
            if (canDrop) {
                this._placeholderGroup.classList.add(DROPPABLE_CLASS);
            }
            else {
                this._placeholderGroup.classList.remove(DROPPABLE_CLASS);
                this._addLabel();
            }
        }
        resetCanDrop() {
            this._placeholderGroup.classList.remove(NOT_ALLOWED_CLASS);
            this._clearLabel();
        }
        setHover(hover) {
            if (hover) {
                this._placeholderGroup.classList.add(HOVER_CLASS);
            }
            else {
                this._placeholderGroup.classList.remove(HOVER_CLASS);
                this._clearLabel();
            }
        }
        async _addLabel() {
            const placeholderWidth = this.context.options.style.placeholder.width;
            const placeholderHeight = this.context.options.style.placeholder.height;
            this._placeholderGroup.classList.add(NOT_ALLOWED_CLASS);
            if (!this.labelText)
                return;
            const label = await PlaceholderLabel.create(this.element, this.labelText, this.index, this.context);
            this._notAllowedLabel = label;
            const labelOffsetX = (placeholderWidth - label.width) / 2;
            const labelOffsetY = (placeholderHeight - label.height) / 2;
            DomHelper.translate(label.element, labelOffsetX, labelOffsetY);
        }
        _clearLabel() {
            const notAllowedLabel = this._notAllowedLabel;
            if (notAllowedLabel && this.element.contains(notAllowedLabel.element)) {
                this.element.removeChild(notAllowedLabel.element);
            }
        }
        getSelectableElement() {
            return null;
        }
    }

    class Placeholder {
        constructor(view, context, indexInSequence, parentNode) {
            this.view = view;
            this.context = context;
            this.indexInSequence = indexInSequence;
            this.parentNode = parentNode;
            this.canDrop = true;
            context.designerState.selectedPlaceholder.subscribe(async (selectedPlaceholder) => {
                if (selectedPlaceholder === this) {
                    this.setHover(true);
                    this._node = context.designerState.draggedNode || context.designerState.selectedComponent.getValue()?.node;
                    if (this._node) {
                        this.canDrop = await this._canDropNode(this._node);
                        this._setCanDrop(this.canDrop);
                    }
                    else {
                        this.setHover(false);
                        this._resetCanDrop();
                    }
                }
                else {
                    this.setHover(false);
                    this._resetCanDrop();
                }
            });
        }
        findByClick(click) {
            return null;
        }
        findById(nodeId) {
            return null;
        }
        static async create(parentElement, parentNode, context, index) {
            const view = await PlaceholderView.create(parentElement, index, context);
            const placeholder = new Placeholder(view, context, index, parentNode);
            context.designerState.placeholders?.push(placeholder);
            return placeholder;
        }
        show() {
            this.view.showPlaceholder();
        }
        hide() {
            this.view.hidePlaceholder();
        }
        setHover(hover) {
            this.view.setHover(hover);
        }
        _resetCanDrop() {
            this.view.resetCanDrop();
        }
        _setCanDrop(value) {
            this.view.setCanDrop(value);
        }
        async _canDropNode(node) {
            let canDrop = true;
            // Check if we are not dropping a terminator as latest
            let placeholderIsLast = false;
            let totalNodes = 0;
            if (this.parentSequence) {
                totalNodes = this.parentSequence.nodes.length;
                if (this.indexInSequence === totalNodes) {
                    placeholderIsLast = true;
                }
            }
            if (node.type === 'terminator') {
                if (!placeholderIsLast && totalNodes > 0 || this.parentSequence.parentNode === null) {
                    canDrop = false;
                }
            }
            // Check if previous node is a terminator
            if (canDrop) {
                const previousNodeIndex = this.indexInSequence - 1;
                if (previousNodeIndex >= 0) {
                    const previousNode = this.parentSequence.nodes[previousNodeIndex];
                    if (previousNode && previousNode.type === 'terminator') {
                        canDrop = false;
                    }
                }
            }
            if (!canDrop) {
                this._setCanDrop(false);
                this.view.labelText = this.context.options.strings['placeholder.not-allowed-to-drop.label'];
                return canDrop;
            }
            else {
                if (this._node && this.context.userDefinedFunctions?.canDropNode) {
                    const customValidationResult = await this.context.userDefinedFunctions.canDropNode({
                        node: this._node,
                        parent: this.parentNode,
                        index: this.indexInSequence,
                    });
                    canDrop = customValidationResult.allowed;
                    if (!canDrop && customValidationResult.label) {
                        this.view.labelText = customValidationResult.label;
                    }
                }
            }
            return canDrop;
        }
    }

    class SequenceView {
        constructor(element, parent, nodes, width, height, joinX, joinY, componentInstances, context, placeholders) {
            this.element = element;
            this.parent = parent;
            this.nodes = nodes;
            this.width = width;
            this.height = height;
            this.joinX = joinX;
            this.joinY = joinY;
            this.componentInstances = componentInstances;
            this.context = context;
            this.placeholders = placeholders;
        }
        static async create(parentElement, nodes, parentNode, context) {
            const flowMode = context.designerState.flowMode;
            const placeholderWidth = context.options.style.placeholder.width;
            const placeholderHeight = context.options.style.placeholder.height;
            const element = DomHelper.svg('g', {
                class: "sequence nodes",
            });
            let maxWidth = 0;
            let maxJoinX = 0;
            let maxHeight = 0;
            let maxJoinY = 0;
            const components = [];
            let index = 0;
            for (const node of nodes) {
                const component = await context.componentCreator.createComponent(node, parentNode, element, context);
                if (!component)
                    continue;
                component.indexInSequence = index;
                if (component.view.width > maxWidth) {
                    maxWidth = component.view.width;
                }
                if (component.view.joinX > maxJoinX) {
                    maxJoinX = component.view.joinX;
                }
                if (component.view.height > maxHeight) {
                    maxHeight = component.view.height;
                }
                if (component.view.joinY > maxJoinY) {
                    maxJoinY = component.view.joinY;
                }
                components.push(component);
                index++;
            }
            const placeholders = [];
            let sequenceHeight = 0;
            let sequenceWidth = 0;
            // Create first placeholder
            const firstPlaceholder = await Placeholder.create(element, parentNode, context, 0);
            placeholders.push(firstPlaceholder);
            sequenceHeight = sequenceHeight + placeholderHeight;
            sequenceWidth = sequenceWidth + placeholderWidth;
            let offsetX = maxJoinX - placeholderWidth / 2;
            if (!maxJoinX && !parentNode || nodes.length === 0) {
                // The sequence is empty and this is the only placeholder
                offsetX = 0;
            }
            let offsetY = maxJoinY - placeholderHeight / 2;
            if (!maxJoinY && !parentNode || nodes.length === 0) {
                // The sequence is empty and this is the only placeholder
                offsetY = 0;
            }
            if (flowMode === 'vertical') {
                DomHelper.translate(firstPlaceholder.view.element, offsetX, 0);
            }
            else {
                DomHelper.translate(firstPlaceholder.view.element, 0, offsetY);
            }
            let lastTaskOffsetX = 0;
            let lastTaskOffsetY = 0;
            const totalComponents = components.length;
            for (let i = 0; i < totalComponents; i++) {
                const component = components[i];
                const nodeView = component.view;
                if (flowMode === 'vertical') {
                    const offsetX = maxJoinX - component.view.joinX;
                    // Center component
                    DomHelper.translate(nodeView.element, offsetX, sequenceHeight);
                    // Add join to previous element
                    JoinView.createConnectionJoin(element, { x: maxJoinX, y: lastTaskOffsetY }, sequenceHeight - lastTaskOffsetY, context);
                }
                else {
                    const offsetY = maxJoinY - component.view.joinY;
                    // Center component
                    DomHelper.translate(nodeView.element, sequenceWidth, offsetY);
                    // Add join to previous element
                    JoinView.createConnectionJoin(element, { x: lastTaskOffsetX, y: maxJoinY }, sequenceWidth - lastTaskOffsetX, context);
                }
                sequenceWidth = sequenceWidth + nodeView.width;
                sequenceHeight = sequenceHeight + nodeView.height;
                lastTaskOffsetX = sequenceWidth;
                lastTaskOffsetY = sequenceHeight;
                const placeholder = await Placeholder.create(element, parentNode, context, i + 1);
                placeholders.push(placeholder);
                if (flowMode === 'vertical') {
                    DomHelper.translate(placeholder.view.element, maxJoinX - placeholderWidth / 2, sequenceHeight);
                    sequenceHeight = sequenceHeight + placeholderHeight;
                }
                else {
                    DomHelper.translate(placeholder.view.element, sequenceWidth, maxJoinY - placeholderHeight / 2);
                    sequenceWidth = sequenceWidth + placeholderWidth;
                }
            }
            if (totalComponents === 0) {
                sequenceWidth = placeholderWidth;
                sequenceHeight = placeholderHeight;
                maxWidth = placeholderWidth;
                maxHeight = placeholderHeight;
                maxJoinX = maxWidth / 2;
                maxJoinY = maxHeight / 2;
            }
            parentElement.appendChild(element);
            const width = (flowMode === 'vertical') ? maxWidth : sequenceWidth;
            const height = (flowMode === 'vertical') ? sequenceHeight : maxHeight;
            return new SequenceView(element, parentElement, nodes, width, height, maxJoinX, maxJoinY, components, context, placeholders);
        }
        getSelectableElement() {
            return null;
        }
    }

    class Sequence {
        constructor(view, context, nodes, parentNode) {
            this.view = view;
            this.context = context;
            this.nodes = nodes;
            this.parentNode = parentNode;
            for (const component of view.componentInstances) {
                component.parentSequence = this;
            }
        }
        static async create(sequenceNodes, parentNode, parentElement, context) {
            const view = await SequenceView.create(parentElement, sequenceNodes, parentNode, context);
            const sequence = new Sequence(view, context, sequenceNodes, parentNode);
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
        findById(nodeId) {
            for (const componentInstance of this.view.componentInstances) {
                const element = componentInstance.findById(nodeId);
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
        constructor(element, parent, width, height, joinX, joinY) {
            this.element = element;
            this.parent = parent;
            this.width = width;
            this.height = height;
            this.joinX = joinX;
            this.joinY = joinY;
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
                cx: radius,
                cy: radius,
            });
            const label = LabelView.create('Start', context);
            DomHelper.translate(label.element, radius, radius);
            parent.appendChild(element);
            element.appendChild(circle);
            element.appendChild(label.element);
            return new StartView(element, parent, diameter, diameter, radius, radius);
        }
        getSelectableElement() {
            return null;
        }
    }

    class Start extends ChildlessComponent {
        static create(parent, context) {
            const view = StartView.create(parent, context);
            return new Start(view, context);
        }
    }

    class WorkflowScaleInteraction {
        constructor(workflow, context) {
            this.workflow = workflow;
            this.context = context;
            this._scaleStep = 1.1;
        }
        static create(workflow, context) {
            const interaction = new WorkflowScaleInteraction(workflow, context);
            interaction._workflowWrapper = workflow.view.wrapper;
            return interaction;
        }
        onWheel(delta, mousePosition) {
            const currentScale = this.context.designerState?.scale ? this.context.designerState.scale : 1;
            let nextScale = currentScale;
            if (delta > 0) {
                // Scroll down
                nextScale = nextScale / this._scaleStep;
                if (nextScale < WorkflowScaleInteraction.minZoomLevel) {
                    nextScale = WorkflowScaleInteraction.minZoomLevel;
                }
            }
            else {
                // Scroll up
                nextScale = nextScale * this._scaleStep;
                if (nextScale > WorkflowScaleInteraction.maxZoomLevel) {
                    nextScale = WorkflowScaleInteraction.maxZoomLevel;
                }
            }
            // Prevent zoom if we have reached max or min scale value.
            if (currentScale === nextScale) {
                return;
            }
            const workspaceRect = this.context.designerState.workspaceRect;
            if (workspaceRect) {
                mousePosition.x = mousePosition.x - workspaceRect.left;
                mousePosition.y = mousePosition.y - workspaceRect.top;
            }
            const workflowPosition = this.context.designerState.workflowPositionInWorkspace;
            let workflowPositionX = workflowPosition?.x ? workflowPosition.x : 0;
            let workflowPositionY = workflowPosition?.y ? workflowPosition.y : 0;
            // Pan the svg while zooming
            const ratio = 1 - nextScale / currentScale;
            workflowPositionX += (mousePosition.x - workflowPositionX) * ratio;
            workflowPositionY += (mousePosition.y - workflowPositionY) * ratio;
            this._workflowWrapper.setAttribute('transform', `translate(${workflowPositionX}, ${workflowPositionY}) scale(${nextScale})`);
            this.context.designerState.scale = nextScale;
            this.context.designerState.workflowPositionInWorkspace = {
                x: workflowPositionX,
                y: workflowPositionY,
            };
            EventEmitter.emitWorkflowScaleEvent(this.workflow.view.element, {
                scale: this.context.designerState.scale,
            });
        }
    }
    WorkflowScaleInteraction.minZoomLevel = 0.05;
    WorkflowScaleInteraction.maxZoomLevel = 2;

    class WorkflowView {
        constructor(element, parent, context, width, height, joinX, joinY) {
            this.element = element;
            this.parent = parent;
            this.context = context;
            this.width = width;
            this.height = height;
            this.joinX = joinX;
            this.joinY = joinY;
        }
        static async create(parent, context) {
            const flowMode = context.designerState.flowMode;
            const placeholderWidth = context.options.style.placeholder.width;
            const placeholderHeight = context.options.style.placeholder.height;
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
            const nodes = context.tree;
            const sequence = await Sequence.create(nodes, null, workflowWrapper, context);
            let maxJoinX = sequence.view.joinX;
            let maxJoinY = sequence.view.joinY;
            let totalWidth = start.view.width + sequence.view.width;
            let totalHeight = start.view.height + sequence.view.height;
            const end = End.create(workflowWrapper, context);
            if (flowMode === 'vertical') {
                // Add last join
                JoinView.createConnectionJoin(workflowWrapper, { x: maxJoinX, y: totalHeight - placeholderHeight }, placeholderHeight, context);
                DomHelper.translate(sequence.view.element, 0, start.view.height);
                DomHelper.translate(start.view.element, maxJoinX - start.view.joinX, 0);
                DomHelper.translate(end.view.element, maxJoinX - end.view.joinX, totalHeight);
                totalHeight = totalHeight + end.view.height;
            }
            else {
                // Add last join
                JoinView.createConnectionJoin(workflowWrapper, { x: totalWidth - placeholderWidth, y: maxJoinY }, placeholderWidth, context);
                DomHelper.translate(sequence.view.element, start.view.width, 0);
                DomHelper.translate(start.view.element, 0, maxJoinY - start.view.joinY);
                DomHelper.translate(end.view.element, totalWidth, maxJoinY - end.view.joinY);
                totalWidth = totalWidth + end.view.width;
            }
            svg.appendChild(workflowWrapper);
            parent.appendChild(svg);
            const workflowView = new WorkflowView(svg, parent, context, totalWidth, totalHeight, maxJoinX, maxJoinY);
            workflowView.mainSequence = sequence;
            workflowView.wrapper = workflowWrapper;
            if (!context.designerState.workflowPositionInWorkspace) {
                workflowView.fitAndCenter();
            }
            else {
                const workflowPosition = context.designerState.workflowPositionInWorkspace;
                const zoomLevel = context.designerState.scale;
                workflowWrapper.setAttribute('transform', `translate(${workflowPosition.x}, ${workflowPosition.y}) scale(${zoomLevel})`);
            }
            return workflowView;
        }
        findByClick(click) {
            return this.mainSequence.findByClick(click);
        }
        findById(nodeId) {
            return this.mainSequence.findById(nodeId);
        }
        // Center workflowWrapper into svg
        fitAndCenter() {
            const parentRect = this.parent.getBoundingClientRect();
            const parentHeight = parentRect.height;
            const parentWidth = parentRect.width;
            const workflowPadding = 50;
            let scale = Math.min(parentWidth / (this.width + workflowPadding), parentHeight / (this.height + workflowPadding));
            if (scale > WorkflowScaleInteraction.maxZoomLevel) {
                scale = WorkflowScaleInteraction.maxZoomLevel;
            }
            const scaledWidth = this.width * scale;
            const scaledHeight = this.height * scale;
            const offsetX = (parentWidth - scaledWidth) / 2;
            const offsetY = (parentHeight - scaledHeight) / 2;
            let workflowPosition = {
                x: offsetX,
                y: offsetY,
            };
            this.context.designerState.scale = scale;
            this.context.designerState.workflowPositionInWorkspace = workflowPosition;
            this.wrapper.setAttribute('transform', `translate(${workflowPosition.x}, ${workflowPosition.y}) scale(${scale})`);
            PlaceholderFinder.getInstance().recalculatePositions();
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
                class: "marker-path",
                d: "M 0 0 L 10 5 L 0 10 z",
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
            return this.view.findByClick(click);
        }
        findById(nodeId) {
            return this.view.findById(nodeId);
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
        bindMouseUp(handler) {
            this.element.addEventListener('mouseup', (e) => {
                e.preventDefault();
                handler(readMousePosition(e), e.target, buttonIndexToType(e.button));
            }, false);
        }
        bindMouseDown(handler) {
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
        constructor(data, dataComparator) {
            this._observers = [];
            this._data = data;
            if (dataComparator) {
                this._dataComparator = dataComparator;
            }
        }
        next(data) {
            const equals = this._compareValues(this._data, data);
            if (equals)
                return;
            this._previousData = this._data;
            this._data = data;
            for (const observer of this._observers) {
                observer(this._data);
            }
        }
        subscribe(observerFunction) {
            this._observers.push(observerFunction);
        }
        getPreviousValue() {
            return this._previousData;
        }
        getValue() {
            return this._data;
        }
        _compareValues(oldValue, newValue) {
            if (this._dataComparator) {
                return this._dataComparator(oldValue, newValue);
            }
            else {
                return oldValue === newValue;
            }
        }
    }

    class WorkflowMoveInteraction {
        constructor(workflow, context) {
            this.workflow = workflow;
            this.context = context;
            this._hasMoved = false;
            this._offsetForDrag = 4;
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
            if (distance(delta) < this._offsetForDrag)
                return;
            const workflowRect = this.workflow.view.element.getBoundingClientRect();
            let workflowPosition = subtract(this._startPosition, delta);
            // Compensate the workflow view translation
            workflowPosition = subtract(workflowPosition, {
                x: workflowRect.left,
                y: workflowRect.top,
            });
            workflowPosition = subtract(workflowPosition, this._mouseClickOffsetFromComponent);
            const zoomLevel = this.context.designerState.scale;
            this._workflowWrapper.setAttribute('transform', `translate(${workflowPosition?.x ? workflowPosition.x : 0}, ${workflowPosition?.y ? workflowPosition.y : 0}) scale(${zoomLevel})`);
            this.context.designerState.workflowPositionInWorkspace = workflowPosition;
            this._hasMoved = true;
            this.context.designerState.wasMoving = true;
        }
        onEnd() {
            this.workflow.view.element.classList.remove('moving');
            const postion = this.context.designerState.workflowPositionInWorkspace;
            if (this._hasMoved && postion) {
                EventEmitter.emitWorkflowPanEvent(this.workflow.view.element, {
                    position: postion,
                });
            }
        }
    }

    class DragExternalInteraction {
        constructor(element, context, placeholderFinder) {
            this.element = element;
            this.context = context;
            this.placeholderFinder = placeholderFinder;
        }
        static create(element, context) {
            const placeholderFinder = PlaceholderFinder.getInstance();
            return new DragExternalInteraction(element, context, placeholderFinder);
        }
        onStart(startMousePosition) {
            this._startPosition = startMousePosition;
            const componentRect = this.element.getBoundingClientRect();
            this._mouseClickOffsetFromComponent = subtract(startMousePosition, {
                x: componentRect.x,
                y: componentRect.y,
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
            // We must compensate the element position with the workspace offset
            const workspaceRect = this.context.designerState.workspaceRect;
            if (workspaceRect) {
                newPosition.x = newPosition.x - workspaceRect.left;
                newPosition.y = newPosition.y - workspaceRect.top;
            }
            const elementRect = this.element.getBoundingClientRect();
            const placeholder = this.placeholderFinder.findByPosition(newPosition, elementRect.width, elementRect.height);
            // This is a workaround for the dragend event because when you are dragging an HtmlElement and you release the mouse a last drag event is emitted before dragend and it could override the placeholder value.
            setTimeout(() => {
                this.context.designerState.selectedPlaceholder.next(placeholder);
            }, 5);
        }
        onEnd() {
            const currentPlaceholder = this.context.designerState.selectedPlaceholder.getValue();
            const draggedNode = this.context.designerState.draggedNode;
            if (currentPlaceholder && currentPlaceholder.canDrop && draggedNode) {
                const canAttachNodeFn = this.context.userDefinedFunctions?.canAttachNode;
                if (canAttachNodeFn) {
                    const event = {
                        node: draggedNode,
                        parent: null,
                        action: "add",
                        index: null,
                    };
                    canAttachNodeFn(event).then((result) => {
                        if (result === true) {
                            this._attachNode(currentPlaceholder, draggedNode);
                        }
                    });
                }
                else {
                    this._attachNode(currentPlaceholder, draggedNode);
                }
            }
            if (this.context.designerState.placeholders) {
                for (const placeholder of this.context.designerState.placeholders) {
                    placeholder.hide();
                }
            }
            this.context.designerState.draggedNode = undefined;
            this.context.designerState.selectedPlaceholder.next(null);
        }
        _attachNode(placeholder, node) {
            const targetSequence = placeholder.parentSequence;
            SequenceModifier.add(targetSequence, {
                node: node,
                parentNode: targetSequence.parentNode,
            }, placeholder.indexInSequence);
        }
    }

    function spacebarKey(event) {
        return event.code === 'Space' || event.keyCode === 32;
    }
    function delKey(event) {
        return event.code === 'Delete' || event.keyCode === 46;
    }

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
            if (context.userDefinedFunctions?.canRemoveNode) {
                const event = {
                    node: componentInstance.node,
                    parent: componentInstance.parentNode,
                    index: componentInstance.indexInSequence,
                };
                context.userDefinedFunctions.canRemoveNode(event).then((result) => {
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
            const componentWithNode = this.context.designerState.selectedComponent.getValue();
            if (!componentWithNode)
                return;
            if (instanceOfComponentInstance(componentWithNode)) {
                removeNode(componentWithNode, this.context);
            }
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
                if (item.disabled) {
                    menuItem.style.opacity = "0.5";
                    menuItem.style.cursor = 'default';
                    menuItem.style.pointerEvents = 'none';
                }
                else {
                    menuItem.addEventListener('mousedown', (e) => item.action(e), false);
                }
                contextMenuItems.append(menuItem);
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
        static create(position, context, actions) {
            const componentContextMenu = new ComponentContextMenuView();
            const currentSelectedNodeInstance = context.designerState.selectedComponent.getValue();
            currentSelectedNodeInstance?.node;
            const items = [];
            for (const item of Object.values(actions)) {
                items.push({
                    label: item.label,
                    action: item.action,
                    disabled: item.disabled
                });
            }
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
        return value != null && typeof value === 'object' && !Array.isArray(value);
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
            if (customIcon) {
                const iconContainer = StepView._createIcons(customIcon);
                step.appendChild(iconContainer);
            }
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
            containerWidth = labelWidth + totalIconSizes * 2;
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
                let iconImage;
                if (typeof customIcon === 'string') {
                    iconImage = DomHelper.svg('image', {
                        class: "label-icon",
                        href: customIcon,
                        width: iconSize,
                        height: iconSize,
                        x: 0,
                        y: 0,
                    });
                }
                else if (customIcon instanceof SVGElement) {
                    iconImage = DomHelper.svg('g', {
                        class: 'label-icon',
                    });
                    iconImage.appendChild(customIcon);
                }
                else {
                    iconImage = DomHelper.svg('foreignObject', {
                        width: iconSize,
                        height: iconSize,
                        x: 0,
                        y: 0,
                    });
                    const labelIcon = DomHelper.element('div', {
                        class: 'label-icon',
                    });
                    iconImage.appendChild(labelIcon);
                    labelIcon.appendChild(customIcon);
                }
                if (iconImage) {
                    customIconContainer.appendChild(iconBg);
                    customIconContainer.appendChild(iconImage);
                    DomHelper.translate(customIconContainer, dragIconSize, 0);
                    iconContainer.appendChild(customIconContainer);
                }
            }
            return iconContainer;
        }
    }
    StepView.defaultWidth = 200;
    StepView.defaultHeight = 46;

    class ChoiceLabel {
        constructor(element, width, height) {
            this.element = element;
            this.width = width;
            this.height = height;
        }
        static async create(parentElement, node, parentNode, columnIndex, context) {
            const height = 20;
            const element = DomHelper.svg('g', {
                class: `choice-label choice-label-index-${columnIndex}`,
            });
            let text;
            if (context.userDefinedOverriders?.overrideColumnLabel) {
                text = await context.userDefinedOverriders.overrideColumnLabel(node, parentNode, columnIndex);
            }
            else {
                text = `#${columnIndex + 1}`;
            }
            const label = LabelView.create(text, context, {
                class: [
                    'choice-label-text',
                ]
            });
            const labelWidth = label.textLength + 20;
            const labelOffsetX = labelWidth / 2;
            const labelOffsetY = height / 2;
            DomHelper.translate(label.element, labelOffsetX, labelOffsetY);
            const background = DomHelper.svg('rect', {
                class: 'choice-label-background',
                width: labelWidth,
                height: height,
                rx: 10,
            });
            element.appendChild(background);
            element.appendChild(label.element);
            parentElement.appendChild(element);
            return new ChoiceLabel(element, labelWidth, height);
        }
    }

    async function addHasErrorIfNecessary(element, node, parentNode, context) {
        if (context.userDefinedFunctions?.hasError) {
            const hasError = await context.userDefinedFunctions.hasError({
                node: node,
                parent: parentNode,
            });
            if (hasError === true) {
                element.classList.add('has-error');
            }
        }
    }

    class ChoiceView {
        constructor(element, parent, width, height, joinX, joinY, childSequences) {
            this.element = element;
            this.parent = parent;
            this.width = width;
            this.height = height;
            this.joinX = joinX;
            this.joinY = joinY;
            this.childSequences = childSequences;
        }
        static async create(parentElement, node, parentNode, context) {
            const element = DomHelper.svg('g', {
                class: "choice",
            });
            element.classList.add(...getNodeClasses(node));
            const stepView = await StepView.create(node, context);
            const choiceLabelWidth = stepView.width;
            const choiceLabelHeight = stepView.height;
            const placeholderWidth = context.options.style.placeholder.width;
            const placeholderHeight = context.options.style.placeholder.height;
            // Bottom circle icon
            const labelIcon = DomHelper.svg('g', {
                class: "map-label-icon",
            });
            labelIcon.appendChild(DomHelper.svg('circle', {
                r: 12,
                class: 'circle-label-icon',
                'stroke-width': 1.25,
            }));
            const iconSize = 20;
            labelIcon.appendChild(DomHelper.svg('image', {
                href: img$2,
                width: iconSize,
                height: iconSize,
                x: -iconSize / 2,
                y: -iconSize / 2,
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
            if (!node.props) {
                node.props = {
                    choices: [],
                };
            }
            const props = node.props;
            if (!props?.choices) {
                props.choices = [];
            }
            const choices = props.choices;
            if (!choices || choices.length < 2) {
                for (let i = choices.length; i < 2; i++) {
                    choices.push([]);
                }
            }
            const totalChoices = (choices).length;
            const sequences = [];
            const columnPadding = 10;
            const flowMode = context.designerState.flowMode;
            let totalColumnsWidth = 0;
            let totalColumnsHeight = 0;
            let maxWidth = choiceLabelWidth;
            let maxHeight = choiceLabelHeight;
            // Preprocess columns
            const columnsMap = [];
            for (let i = 0; i < totalChoices; i++) {
                const nodes = props.choices[i] || [];
                const sequence = await Sequence.create(nodes, node, parentElement, context);
                if (!sequence)
                    continue;
                sequences.push(sequence);
                const choiceColumn = DomHelper.svg('g', {
                    class: `choice-column choice-column-index-${i}`,
                });
                const choiceColumnContainer = DomHelper.svg('g', {
                    class: "choice-column-container",
                });
                const choiceInfoLabel = await ChoiceLabel.create(choiceColumnContainer, node, parentNode, i, context);
                let columnWidth = 0;
                let columnHeight = 0;
                let joinX = 0;
                let joinY = 0;
                if (flowMode === 'vertical') {
                    columnWidth = sequence.view.width + (columnPadding * 2);
                    columnHeight = sequence.view.height + choiceInfoLabel.height + (columnPadding * 2);
                    joinX = columnWidth / 2;
                    joinY = columnHeight - placeholderHeight;
                    totalColumnsWidth = totalColumnsWidth + columnWidth;
                    if (columnHeight > maxHeight) {
                        maxHeight = columnHeight;
                        totalColumnsHeight = maxHeight;
                    }
                }
                else {
                    columnWidth = sequence.view.width + choiceInfoLabel.width + placeholderWidth + (columnPadding * 2);
                    columnHeight = sequence.view.height + (columnPadding * 2);
                    joinX = columnWidth - placeholderWidth - (columnPadding * 2);
                    if (nodes.length === 0) {
                        joinX = joinX - placeholderWidth;
                    }
                    joinY = columnHeight / 2;
                    totalColumnsHeight = totalColumnsHeight + columnHeight;
                    if (columnWidth > maxWidth) {
                        maxWidth = columnWidth;
                        totalColumnsWidth = maxWidth;
                    }
                }
                columnsMap.push({
                    sequence: sequence,
                    column: choiceColumn,
                    container: choiceColumnContainer,
                    infoLabel: choiceInfoLabel,
                    columnWidth: columnWidth,
                    columnHeight: columnHeight,
                    joinX: joinX,
                    joinY: joinY,
                    offsetX: 0,
                    offsetY: 0,
                    hasTerminator: false,
                });
            }
            const choicesContainerTopOffset = choiceLabelHeight + placeholderHeight;
            let previousOffsetX = 0;
            let previousOffsetY = 0;
            for (let i = 0; i < columnsMap.length; i++) {
                const column = columnsMap[i];
                const sequence = column.sequence;
                const choiceColumn = column.column;
                const choiceColumnContainer = column.container;
                const choiceInfoLabel = column.infoLabel;
                const totalNodesInSequence = sequence.nodes.length;
                const sequenceView = sequence.view;
                const choiceColumnBg = DomHelper.svg('rect', {
                    class: "choice-column-bg",
                    width: (flowMode === 'vertical') ? column.columnWidth : maxWidth,
                    height: (flowMode === 'vertical') ? maxHeight : column.columnHeight,
                    rx: 6,
                });
                choiceColumn.insertBefore(choiceColumnBg, choiceColumn.firstChild);
                choiceColumn.appendChild(choiceColumnContainer);
                choiceColumnContainer.appendChild(sequenceView.element);
                if (flowMode === 'vertical') {
                    const columnOffset = -(totalColumnsWidth - previousOffsetX);
                    DomHelper.translate(choiceColumn, columnOffset, 0);
                    const sequenceOffsetX = -(sequenceView.joinX - sequenceView.width / 2);
                    DomHelper.translate(sequenceView.element, sequenceOffsetX, placeholderHeight / 2);
                    // Add connection info
                    const choiceInfoLabelOffsetX = (column.columnWidth - columnPadding * 2 - choiceInfoLabel.width) / 2;
                    DomHelper.translate(choiceInfoLabel.element, choiceInfoLabelOffsetX, 0);
                    column.offsetX = previousOffsetX - totalColumnsWidth;
                    DomHelper.translate(choiceColumnContainer, columnPadding, 0);
                    DomHelper.translate(choiceColumnBg, 0, choiceLabelHeight / 4);
                    previousOffsetX = previousOffsetX + column.columnWidth;
                }
                else {
                    DomHelper.translate(choiceColumn, stepView.width + placeholderWidth, previousOffsetY);
                    const sequenceOffsetY = -(sequenceView.joinY - sequenceView.height / 2);
                    DomHelper.translate(sequenceView.element, choiceInfoLabel.width, sequenceOffsetY);
                    // Add connection info
                    const choiceInfoLabelOffsetY = (column.columnHeight - columnPadding * 2 - choiceInfoLabel.height) / 2;
                    DomHelper.translate(choiceInfoLabel.element, 0, choiceInfoLabelOffsetY);
                    column.offsetY = previousOffsetY - totalColumnsHeight;
                    DomHelper.translate(choiceColumnContainer, 0, columnPadding);
                    DomHelper.translate(choiceColumnBg, choiceLabelHeight / 4, 0);
                    previousOffsetY = previousOffsetY + column.columnHeight;
                }
                choicesContainer.appendChild(choiceColumn);
                if (totalNodesInSequence > 0) {
                    const lastNode = sequence.nodes[totalNodesInSequence - 1];
                    if (lastNode && lastNode.type === 'terminator') {
                        column.hasTerminator = true;
                    }
                }
            }
            maxHeight = maxHeight + placeholderHeight;
            if (flowMode === 'vertical') {
                DomHelper.translate(choicesContainer, totalColumnsWidth, choicesContainerTopOffset);
                if (totalColumnsWidth > maxWidth) {
                    maxWidth = totalColumnsWidth;
                }
            }
            else {
                // DomHelper.translate(choicesContainer, 0, 0);
                maxWidth = maxWidth + placeholderWidth + stepView.width + placeholderWidth;
            }
            let joinX = maxWidth / 2;
            let joinY = 0;
            if (flowMode === 'vertical') {
                const labelOffsetX = (maxWidth - choiceLabelWidth) / 2;
                DomHelper.translate(stepView.element, labelOffsetX, 0);
                totalColumnsHeight = choiceLabelHeight + maxHeight + placeholderHeight;
                joinY = maxHeight / 2;
            }
            else {
                joinY = totalColumnsHeight / 2;
                const labeloffsetY = (joinY - choiceLabelHeight / 2);
                DomHelper.translate(stepView.element, 0, labeloffsetY);
            }
            // Output connection dot
            const endConnection = DomHelper.svg('circle', {
                r: 5,
                cx: flowMode === 'vertical' ? joinX : maxWidth,
                cy: flowMode === 'vertical' ? totalColumnsHeight : joinY,
                class: 'output choicesContainerConnection',
                fill: "black",
                stroke: "black",
            });
            const firstJoinTargets = [];
            const lastJoinTargets = [];
            if (flowMode === 'vertical') {
                JoinView.createVerticalStraightJoin(element, { x: joinX, y: choicesContainerTopOffset - placeholderHeight }, placeholderHeight / 2);
                for (const column of columnsMap) {
                    const columnJoinX = column.offsetX + column.joinX + totalColumnsWidth;
                    firstJoinTargets.push({
                        x: columnJoinX,
                        y: choicesContainerTopOffset,
                    });
                    if (column.hasTerminator)
                        continue;
                    lastJoinTargets.push({
                        x: columnJoinX,
                        y: column.joinY + choiceLabelHeight + placeholderHeight / 2,
                    });
                }
                JoinView.createHorizontalJoins(element, { x: joinX, y: choicesContainerTopOffset - placeholderHeight / 2 }, firstJoinTargets);
                JoinView.createHorizontalJoins(element, { x: joinX, y: totalColumnsHeight }, lastJoinTargets);
                DomHelper.translate(labelIcon, stepView.width / 2, stepView.height);
            }
            else {
                JoinView.createHorizontalStraightJoin(element, { x: choiceLabelWidth, y: joinY }, placeholderWidth / 2);
                for (const column of columnsMap) {
                    const columnJoinY = column.offsetY + column.joinY + totalColumnsHeight;
                    firstJoinTargets.push({
                        x: choiceLabelWidth + placeholderWidth,
                        y: columnJoinY,
                    });
                    if (column.hasTerminator)
                        continue;
                    lastJoinTargets.push({
                        x: column.joinX + stepView.width,
                        y: columnJoinY,
                    });
                }
                JoinView.createVerticalJoins(element, { x: choiceLabelWidth + placeholderWidth / 2, y: joinY }, firstJoinTargets);
                JoinView.createVerticalJoins(element, { x: maxWidth, y: joinY }, lastJoinTargets);
                DomHelper.translate(labelIcon, stepView.width, stepView.height / 2);
            }
            let choicesContainerBgWidth = choiceLabelWidth;
            if (maxWidth > choicesContainerBgWidth) {
                choicesContainerBgWidth = maxWidth;
            }
            choicesContainerBg.setAttribute('width', `${choicesContainerBgWidth}px`);
            choicesContainerBg.setAttribute('height', `${totalColumnsHeight}px`);
            if (flowMode === 'vertical') {
                const choicesContainerBgTopOffset = 10;
                DomHelper.translate(choicesContainerBg, -(totalColumnsWidth), -choicesContainerTopOffset + choicesContainerBgTopOffset);
            }
            element.appendChild(endConnection);
            element.appendChild(choicesContainer);
            element.appendChild(stepView.element);
            parentElement.appendChild(element);
            await addHasErrorIfNecessary(element, node, parentNode, context);
            const choiceView = new ChoiceView(element, parentElement, maxWidth, totalColumnsHeight, joinX, joinY, sequences);
            choiceView._selectableElement = stepView.element;
            return choiceView;
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
        getSelectableElement() {
            return this._selectableElement;
        }
    }

    class Choice {
        constructor(view, context) {
            this.view = view;
            this.context = context;
            context.designerState?.selectedComponent.subscribe((data) => {
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
            const view = await ChoiceView.create(parentElement, node, parentNode, context);
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
            const viewContains = this.view.getSelectableElement()?.contains(click.target);
            if (viewContains) {
                return this;
            }
            return null;
        }
        findById(nodeId) {
            const sequences = this.view.childSequences;
            for (const sequence of sequences) {
                const component = sequence.findById(nodeId);
                if (component) {
                    return component;
                }
            }
            if (this.node && this.node.id === nodeId) {
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
            context.designerState?.selectedComponent.subscribe((data) => {
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
            const viewContains = this.view.getSelectableElement()?.contains(click.target);
            if (viewContains) {
                return this;
            }
            return null;
        }
        findById(nodeId) {
            const child = this.sequence.findById(nodeId);
            if (child) {
                return child;
            }
            if (this.node && this.node.id === nodeId) {
                return this;
            }
            return null;
        }
    }

    class ParentView {
        constructor(element, parent, width, height, joinX, joinY, sequence) {
            this.element = element;
            this.parent = parent;
            this.width = width;
            this.height = height;
            this.joinX = joinX;
            this.joinY = joinY;
            this.sequence = sequence;
        }
    }

    var img = "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' height='48' width='48'%3e%3cpath d='M8.45 40.75V37.2h5.25l-.25-.25q-3.25-2.8-4.825-5.875Q7.05 28 7.05 24.15q0-5.9 3.725-10.475Q14.5 9.1 20.3 7.65v4.8q-3.8 1.15-6.15 4.425-2.35 3.275-2.35 7.275 0 2.95 1.1 5.1 1.1 2.15 3 3.75l1.2.75V28.5h3.55v12.25Zm19.3-.35v-4.85q3.85-1.15 6.15-4.425 2.3-3.275 2.3-7.275 0-2.2-1.125-4.5t-2.825-4.1l-1.15-1v5.25h-3.6V7.25h12.25v3.55H34.4l.3.35q3.1 2.9 4.675 6.25 1.575 3.35 1.575 6.45 0 5.9-3.7 10.5t-9.5 6.05Z'/%3e%3c/svg%3e";

    class MapView extends ParentView {
        static async create(parent, node, parentNode, context) {
            const props = node.props;
            const nodes = props?.children ? props.children : [];
            context.options.style.placeholder.width;
            const placeholderHeight = context.options.style.placeholder.height;
            const element = DomHelper.svg('g', {
                class: "map",
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
                class: 'circle-label-icon',
                'stroke-width': 1.25,
            }));
            const iconSize = 20;
            mapLabelIcon.appendChild(DomHelper.svg('image', {
                href: img,
                width: iconSize,
                height: iconSize,
                x: -iconSize / 2,
                y: -iconSize / 2,
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
            const flowMode = context.designerState.flowMode;
            // Create sequence
            const sequenceComponent = await Sequence.create(nodes, node, childrenContainer, context);
            const childrenContainerBgLeftOffset = 30;
            const childrenContainerBgTopOffset = 10;
            let totalWidth = 0;
            let totalHeight = 0;
            let joinX;
            let joinY;
            let childrenContainerBgWidth;
            if (flowMode === 'vertical') {
                totalWidth = sequenceComponent.view.width + childrenContainerBgLeftOffset;
                totalHeight = sequenceComponent.view.height + mapLabelHeight - childrenContainerBgTopOffset;
                joinX = totalWidth / 2;
                joinY = totalHeight;
                childrenContainerBgWidth = totalWidth;
            }
            else {
                totalWidth = sequenceComponent.view.width + mapLabelWidth - childrenContainerBgTopOffset;
                totalHeight = sequenceComponent.view.height + childrenContainerBgLeftOffset;
                joinX = totalWidth;
                joinY = totalHeight / 2;
                childrenContainerBgWidth = totalWidth - childrenContainerBgTopOffset;
            }
            childrenContainerBg.setAttribute('width', `${childrenContainerBgWidth}px`);
            childrenContainerBg.setAttribute('height', `${totalHeight}px`);
            // Output connection dot
            const endConnection = DomHelper.svg('circle', {
                r: 5,
                cx: joinX,
                cy: flowMode === 'vertical' ? (joinY + childrenContainerBgTopOffset) : joinY,
                class: 'output',
                fill: "black",
                stroke: "black",
            });
            childrenContainer.appendChild(endConnection);
            if (flowMode === 'vertical') {
                DomHelper.translate(childrenContainerBg, 0, childrenContainerBgTopOffset);
                DomHelper.translate(stepView.element, (totalWidth - mapLabelWidth) / 2, 0);
                DomHelper.translate(sequenceComponent.view.element, childrenContainerBgLeftOffset / 2, placeholderHeight);
                DomHelper.translate(mapLabelIcon, stepView.width / 2, stepView.height);
                totalHeight = totalHeight + childrenContainerBgTopOffset;
            }
            else {
                DomHelper.translate(childrenContainerBg, childrenContainerBgTopOffset, 0);
                DomHelper.translate(stepView.element, 0, (totalHeight - stepView.height) / 2);
                DomHelper.translate(sequenceComponent.view.element, mapLabelWidth, joinY - sequenceComponent.view.joinY);
                DomHelper.translate(mapLabelIcon, stepView.width, stepView.height / 2);
            }
            await addHasErrorIfNecessary(element, node, parentNode, context);
            const mapView = new MapView(element, parent, totalWidth, totalHeight, joinX, joinY, sequenceComponent);
            mapView._selectableElement = stepView.element;
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
        getSelectableElement() {
            return this._selectableElement;
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
            const view = await MapView.create(parentElement, node, parentNode, context);
            const mapComponent = new Map(view, view.sequence, props.children, context);
            mapComponent.node = node;
            mapComponent.parentNode = parentNode;
            return mapComponent;
        }
    }

    class TaskView {
        constructor(element, width, height, joinX, joinY) {
            this.element = element;
            this.width = width;
            this.height = height;
            this.joinX = joinX;
            this.joinY = joinY;
        }
        static async create(parent, node, parentNode, context) {
            if (context.userDefinedOverriders?.overrideTemplate) {
                let customView = await context.userDefinedOverriders.overrideTemplate(node, parentNode);
                if (customView) {
                    const taskView = new TaskView(customView.element, customView.width, customView.height, customView.joinX, customView.joinY);
                    taskView._selectableElement = customView.element;
                    parent.appendChild(customView.element);
                    return taskView;
                }
            }
            const element = DomHelper.svg('g', {
                class: "task",
            });
            element.classList.add(...getNodeClasses(node));
            const stepView = await StepView.create(node, context);
            element.appendChild(stepView.element);
            parent.appendChild(element);
            await addHasErrorIfNecessary(element, node, parentNode, context);
            const taskView = new TaskView(element, stepView.width, stepView.height, stepView.width / 2, stepView.height / 2);
            taskView._selectableElement = element;
            return taskView;
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
        getSelectableElement() {
            return this._selectableElement;
        }
    }

    class Task extends ChildlessComponent {
        static async create(parentElement, node, parentNode, context) {
            const view = await TaskView.create(parentElement, node, parentNode, context);
            const task = new Task(view, context);
            task.node = node;
            task.parentNode = parentNode;
            return task;
        }
    }

    class TerminatorEndView {
        constructor(element, parent, width, height, joinX) {
            this.element = element;
            this.parent = parent;
            this.width = width;
            this.height = height;
            this.joinX = joinX;
        }
        static create(parent, context) {
            const diameter = 30;
            const radius = diameter / 2;
            const element = DomHelper.svg('g', {
                class: "end terminator-end",
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
            return new TerminatorEndView(element, parent, diameter, diameter, diameter / 2);
        }
    }

    class TerminatorView {
        constructor(element, width, height, joinX, joinY) {
            this.element = element;
            this.width = width;
            this.height = height;
            this.joinX = joinX;
            this.joinY = joinY;
        }
        static async create(parent, node, parentNode, context) {
            const element = DomHelper.svg('g', {
                class: "terminator",
            });
            element.classList.add(...getNodeClasses(node));
            const stepView = await StepView.create(node, context);
            element.appendChild(stepView.element);
            const connectionSize = 10;
            const joinX = stepView.width / 2;
            const joinY = stepView.height / 2;
            const endView = await TerminatorEndView.create(element, context);
            const flowMode = context.designerState.flowMode;
            if (flowMode === 'vertical') {
                DomHelper.translate(endView.element, joinX, stepView.height + connectionSize);
                JoinView.createVerticalStraightJoin(element, {
                    x: joinX,
                    y: stepView.height,
                }, connectionSize);
            }
            else {
                DomHelper.translate(endView.element, stepView.width + endView.width / 2 + connectionSize, joinY - endView.height / 2);
                JoinView.createHorizontalStraightJoin(element, {
                    x: stepView.width,
                    y: joinY,
                }, connectionSize);
            }
            parent.appendChild(element);
            await addHasErrorIfNecessary(element, node, parentNode, context);
            let width;
            let height;
            if (flowMode === 'vertical') {
                width = stepView.width;
                height = stepView.height + endView.height + connectionSize;
            }
            else {
                width = stepView.width + endView.width + connectionSize;
                height = stepView.height;
            }
            const terminator = new TerminatorView(element, width, height, joinX, joinY);
            terminator._selectableElement = stepView.element;
            return terminator;
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
        getSelectableElement() {
            return this._selectableElement;
        }
    }

    class Terminator extends ChildlessComponent {
        static async create(parentElement, node, parentNode, context) {
            const view = await TerminatorView.create(parentElement, node, parentNode, context);
            const terminator = new Terminator(view, context);
            terminator.node = node;
            terminator.parentNode = parentNode;
            return terminator;
        }
    }

    class ComponentCreator {
        async createComponent(node, parentNode, parentElement, context) {
            switch (node.type) {
                case 'task':
                    return await Task.create(parentElement, node, parentNode, context);
                case 'map':
                    return await Map.create(parentElement, node, parentNode, context);
                case 'choice':
                    return await Choice.create(parentElement, node, parentNode, context);
                case 'terminator':
                    return await Terminator.create(parentElement, node, parentNode, context);
            }
            return null;
        }
    }

    class Workspace {
        constructor(view, context, parent) {
            this.view = view;
            this.context = context;
            this.parent = parent;
            this._userInteractionController = new UserInteractionController();
            context.designerState?.selectedComponent.subscribe((data) => {
                const previousValue = context.designerState.selectedComponent.getPreviousValue();
                if (previousValue && previousValue !== data) {
                    EventEmitter.emitNodeDeselectEvent(this.view.workflow.view.element, {
                        node: previousValue.node,
                        parent: previousValue.parentNode,
                        index: instanceOfComponentInstance(previousValue) ? previousValue.indexInSequence : null,
                    });
                }
                if (data) {
                    EventEmitter.emitNodeSelectEvent(this.view.workflow.view.element, {
                        node: data.node,
                        parent: data.parentNode,
                        index: instanceOfComponentInstance(data) ? data.indexInSequence : null,
                    });
                }
            });
        }
        // Public methods
        static async init(initData) {
            let options = Workspace._getDefaultOptions();
            if (initData.options) {
                options = deepMerge(Workspace._getDefaultOptions(), initData.options);
            }
            options.style.placeholder = Workspace._getPlaceholderStyle(options.flowMode);
            const context = {
                tree: initData.tree,
                designerState: {
                    placeholders: [],
                    selectedComponent: new Observable(),
                    selectedPlaceholder: new Observable(),
                    scale: 1,
                    flowMode: options.flowMode,
                },
                options: options,
                componentCreator: new ComponentCreator(),
            };
            if (!context.userDefinedEventListeners) {
                context.userDefinedEventListeners = {};
            }
            if (initData.onNodeAdd) {
                context.userDefinedEventListeners.onNodeAdd = initData.onNodeAdd;
            }
            if (initData.onNodeMove) {
                context.userDefinedEventListeners.onNodeMove = initData.onNodeMove;
            }
            if (initData.onNodeSelect) {
                context.userDefinedEventListeners.onNodeSelect = initData.onNodeSelect;
            }
            if (initData.onNodeDeselect) {
                context.userDefinedEventListeners.onNodeDeselect = initData.onNodeDeselect;
            }
            if (initData.onNodeRemove) {
                context.userDefinedEventListeners.onNodeRemove = initData.onNodeRemove;
            }
            if (initData.onWorkflowPan) {
                context.userDefinedEventListeners.onWorkflowPan = initData.onWorkflowPan;
            }
            if (initData.onWorkflowScale) {
                context.userDefinedEventListeners.onWorkflowScale = initData.onWorkflowScale;
            }
            if (initData.onTreeChange) {
                context.userDefinedEventListeners.onTreeChange = initData.onTreeChange;
            }
            if (!context.userDefinedFunctions) {
                context.userDefinedFunctions = {};
            }
            if (initData.onFlowModeChange) {
                context.userDefinedEventListeners.onFlowModeChange = initData.onFlowModeChange;
            }
            if (initData.canRemoveNode) {
                context.userDefinedFunctions.canRemoveNode = initData.canRemoveNode;
            }
            if (initData.canAttachNode) {
                context.userDefinedFunctions.canAttachNode = initData.canAttachNode;
            }
            if (initData.canDropNode) {
                context.userDefinedFunctions.canDropNode = initData.canDropNode;
            }
            if (initData.canSelectNode) {
                context.userDefinedFunctions.canSelectNode = initData.canSelectNode;
            }
            if (initData.canDeselectNode) {
                context.userDefinedFunctions.canDeselectNode = initData.canDeselectNode;
            }
            if (initData.hasError) {
                context.userDefinedFunctions.hasError = initData.hasError;
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
            if (initData.overrideColumnLabel) {
                context.userDefinedOverriders.overrideColumnLabel = initData.overrideColumnLabel;
            }
            if (initData.overrideTemplate) {
                context.userDefinedOverriders.overrideTemplate = initData.overrideTemplate;
            }
            const view = await WorkspaceView.create(initData.parent, context);
            const workspace = new Workspace(view, context, initData.parent);
            workspace._setViewBinds();
            workspace._addEventListeners();
            context.designerState.workspaceRect = workspace.view.element.getBoundingClientRect();
            workspace._rebuildPlaceholderCache();
            return workspace;
        }
        setTree(tree, preservePositionAndScale = false) {
            this._onDefinitionChange(tree, preservePositionAndScale);
        }
        async setOptions(options) {
            let combinedOptions = Workspace._getDefaultOptions();
            combinedOptions = deepMerge(Workspace._getDefaultOptions(), options);
            this.context.options = combinedOptions;
            await this.draw();
        }
        async draw(suppressEvents = true) {
            const currentSelectedNodeInstance = this.context.designerState.selectedComponent.getValue();
            this.context.designerState.placeholders = [];
            this.parent.removeChild(this.view.element);
            const view = await WorkspaceView.create(this.parent, this.context);
            this.view = view;
            this._setViewBinds();
            this._addEventListeners();
            this._rebuildPlaceholderCache();
            // We have to restore the previous selected node if exists
            if (currentSelectedNodeInstance) {
                const nodeId = currentSelectedNodeInstance.node.id;
                const newInstance = this.view.workflow.findById(nodeId);
                if (newInstance && instanceOfComponentWithNode(newInstance)) {
                    if (suppressEvents) {
                        const eventSuppressor = EventSuppressor.getInstance();
                        eventSuppressor.suppress('nodeDeselect');
                        eventSuppressor.suppress('nodeSelect');
                    }
                    this.context.designerState.selectedComponent.next(newInstance);
                }
            }
        }
        startDrag(element, startPosition, node) {
            this.context.designerState.draggedNode = node;
            const dragDropInteraction = DragExternalInteraction.create(element, this.context);
            this._userInteractionController.handleDragInteraction(dragDropInteraction, startPosition);
        }
        fitAndCenter() {
            this.view.workflow.view.fitAndCenter();
        }
        getSelectedNode() {
            const componentWithNode = this.context.designerState.selectedComponent.getValue();
            if (componentWithNode) {
                return componentWithNode.node;
            }
            return null;
        }
        setSelectedNode(value) {
            if (value) {
                const component = this.view.workflow.findById(value.id);
                if (component && instanceOfComponentWithNode(component)) {
                    this.context.designerState.selectedComponent.next(component);
                }
            }
            this._deselectNode();
        }
        getFlowMode() {
            return this.context.designerState.flowMode;
        }
        setFlowMode(flowMode) {
            this.context.designerState.flowMode = flowMode;
            this.context.options.style.placeholder = Workspace._getPlaceholderStyle(flowMode);
            EventEmitter.emitFlowModeChangeEvent(this.view.element, {
                flowMode: flowMode,
            });
            this.draw().then(() => {
                this.fitAndCenter();
            });
        }
        _setViewBinds() {
            this.view.bindMouseUp((position, target, button) => this._onMouseUp(position, target, button));
            this.view.bindMouseDown((position, target, button) => this._onMouseDown(position, target, button));
            this.view.bindWheel((e) => this._onWheel(e));
            this.view.bindContextMenu((position, target) => this._onContextMenu(position, target));
            this.view.bindKeyboard((e) => this._onKeyboard(e));
        }
        _addEventListeners() {
            const context = this.context;
            const workspaceViewElement = this.view.element;
            workspaceViewElement.addEventListener('treeChange', (event) => {
                if (context.userDefinedEventListeners?.onTreeChange) {
                    context.userDefinedEventListeners.onTreeChange(event.detail);
                }
                this._onDefinitionChange(event.detail.tree, true);
                this._rebuildPlaceholderCache();
            });
            workspaceViewElement.addEventListener('nodeSelect', (event) => {
                if (context.userDefinedEventListeners?.onNodeSelect) {
                    const data = event.detail;
                    if (instanceOfComponentWithNode(data)) {
                        context.userDefinedEventListeners.onNodeSelect({
                            node: data.node,
                            parent: data.parent,
                            index: data.index,
                        });
                    }
                    const deleteKeyInteraction = DeleteKeyInteraction.create(this.context);
                    this._userInteractionController.handleKeyboardInteraction(deleteKeyInteraction);
                }
            });
            workspaceViewElement.addEventListener('nodeDeselect', (event) => {
                if (context.userDefinedEventListeners?.onNodeDeselect) {
                    const data = event.detail;
                    if (instanceOfComponentWithNode(data)) {
                        context.userDefinedEventListeners.onNodeDeselect({
                            node: data.node,
                            parent: data.parent,
                            index: data.index,
                        });
                    }
                }
            });
            workspaceViewElement.addEventListener('nodeMove', (event) => {
                const onNodeMoveCallback = context.userDefinedEventListeners?.onNodeMove;
                if (onNodeMoveCallback) {
                    onNodeMoveCallback(event.detail);
                }
                EventEmitter.emitTreeChangeEvent(workspaceViewElement, {
                    tree: context.tree
                });
            });
            workspaceViewElement.addEventListener('nodeAdd', (event) => {
                const onNodeAddCallback = context.userDefinedEventListeners?.onNodeAdd;
                if (onNodeAddCallback) {
                    onNodeAddCallback(event.detail);
                }
                EventEmitter.emitTreeChangeEvent(workspaceViewElement, {
                    tree: context.tree
                });
            });
            workspaceViewElement.addEventListener('nodeRemove', (event) => {
                if (context.userDefinedEventListeners?.onNodeRemove) {
                    context.userDefinedEventListeners.onNodeRemove(event.detail);
                }
                EventEmitter.emitTreeChangeEvent(workspaceViewElement, {
                    tree: context.tree
                });
            });
            workspaceViewElement.addEventListener('workflowPan', (event) => {
                if (context.userDefinedEventListeners?.onWorkflowPan) {
                    context.userDefinedEventListeners.onWorkflowPan(event.detail);
                }
                this._rebuildPlaceholderCache();
            });
            workspaceViewElement.addEventListener('workflowScale', (event) => {
                if (context.userDefinedEventListeners?.onWorkflowScale) {
                    context.userDefinedEventListeners.onWorkflowScale(event.detail);
                }
                this._rebuildPlaceholderCache();
            });
            workspaceViewElement.addEventListener('flowModeChange', (event) => {
                if (context.userDefinedEventListeners?.onFlowModeChange) {
                    context.userDefinedEventListeners.onFlowModeChange(event.detail);
                }
            });
        }
        async _onDefinitionChange(tree, preservePositionAndScale = false) {
            this.context.tree = tree;
            if (!preservePositionAndScale) {
                this.context.designerState.workflowPositionInWorkspace = undefined;
                this.context.designerState.scale = 1;
            }
            await this.draw();
        }
        _onMouseUp(position, target, button) {
            // We have to check if the previous interaction was a node or worklow movement, in that case we have to skip the mouseup event
            if (this.context.designerState.wasMoving) {
                this.context.designerState.wasMoving = false;
                return;
            }
            if (button === MouseButton.LEFT || button === MouseButton.MIDDLE) {
                this._clearContextMenus();
                const workflow = this.view.workflow;
                const click = {
                    position: position,
                    target: target,
                };
                let componentInstance;
                if (!this.context.designerState.isPressingCtrl) {
                    componentInstance = workflow.findByClick(click);
                    if (componentInstance && instanceOfComponentWithNode(componentInstance)) {
                        // Select a node
                        const componentWithNode = componentInstance;
                        const previousSelectedComponent = this.context.designerState.selectedComponent.getValue();
                        if (previousSelectedComponent) {
                            // We have to check if we can deselect the previous component before
                            const canDeselectNodeFn = this.context.userDefinedFunctions?.canDeselectNode;
                            if (canDeselectNodeFn) {
                                canDeselectNodeFn({
                                    node: previousSelectedComponent.node,
                                    parent: previousSelectedComponent.parentNode,
                                    index: instanceOfComponentInstance(previousSelectedComponent) ? previousSelectedComponent.indexInSequence : null,
                                }).then((result) => {
                                    if (result === true) {
                                        this._deselectNode();
                                        this._selectNodeFlow(componentWithNode);
                                    }
                                });
                            }
                            else {
                                this._deselectNode();
                                this._selectNodeFlow(componentWithNode);
                            }
                        }
                        else {
                            this._selectNodeFlow(componentWithNode);
                        }
                    }
                    else {
                        // Deselect a node
                        const previousSelectedNode = this.context.designerState?.selectedComponent.getValue();
                        if (previousSelectedNode) {
                            const canDeselectNodeFn = this.context.userDefinedFunctions?.canDeselectNode;
                            if (canDeselectNodeFn) {
                                canDeselectNodeFn({
                                    node: previousSelectedNode.node,
                                    parent: previousSelectedNode.parentNode,
                                    index: instanceOfComponentInstance(previousSelectedNode) ? previousSelectedNode.indexInSequence : null,
                                }).then((result) => {
                                    if (result === true) {
                                        this._deselectNode();
                                    }
                                });
                            }
                            else {
                                this._deselectNode();
                            }
                        }
                    }
                    if (componentInstance) {
                        const userInteraction = SelectComponentInteraction.create(componentInstance, this.context);
                        this._userInteractionController.handleClickInteraction(userInteraction, position);
                    }
                }
            }
        }
        _selectNodeFlow(componentInstance) {
            const canSelectNodeFn = this.context.userDefinedFunctions?.canSelectNode;
            if (canSelectNodeFn) {
                canSelectNodeFn({
                    node: componentInstance.node,
                    parent: componentInstance.parentNode,
                    index: componentInstance.indexInSequence,
                }).then((result) => {
                    if (result === true) {
                        this.context.designerState?.selectedComponent.next(componentInstance);
                    }
                });
            }
            else {
                this.context.designerState?.selectedComponent.next(componentInstance);
            }
        }
        _deselectNode() {
            this.context.designerState.selectedComponent.next(null);
        }
        _onMouseDown(position, target, button) {
            if (button === MouseButton.LEFT || button === MouseButton.MIDDLE) {
                const workflow = this.view.workflow;
                const click = {
                    position: position,
                    target: target,
                };
                const componentInstance = workflow.findByClick(click);
                let userInteraction;
                if (componentInstance && !this.context.designerState.isPressingCtrl) {
                    if (instanceOfComponentWithNode(componentInstance)) {
                        this.context.designerState.draggedNode = componentInstance.node;
                    }
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
            if (componentInstance && instanceOfComponentWithNode(componentInstance)) {
                this.context.designerState?.selectedComponent.next(componentInstance);
                contextMenu = ComponentContextMenuView.create(position, this.context, {
                    'remove': {
                        label: this.context.options.strings['context-menu.component.actions.remove.label'],
                        action: (e) => this._onContextMenuRemoveAction(e, componentInstance),
                    },
                });
            }
            else {
                this._deselectNode();
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
        _onContextMenuFitAndCenter(e) {
            e.preventDefault();
            this.fitAndCenter();
        }
        static _getDefaultOptions() {
            return {
                flowMode: "vertical",
                style: {
                    fontSize: "1em",
                    fontFamily: 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
                    placeholder: Workspace._getPlaceholderStyle('vertical'),
                },
                strings: {
                    "context-menu.component.actions.remove.label": "Remove",
                    "context-menu.workspace.actions.fitandcenter.label": "Fit and center",
                    "placeholder.not-allowed-to-drop.label": "You can't attach a node here",
                }
            };
        }
        _rebuildPlaceholderCache() {
            const placeholders = this.context.designerState.placeholders;
            if (placeholders != null) {
                const placeholderFinder = PlaceholderFinder.getInstance();
                placeholderFinder.buildCache(placeholders);
            }
        }
        static _getPlaceholderStyle(flowMode) {
            if (flowMode === 'vertical') {
                return {
                    width: 120,
                    height: 40,
                };
            }
            else {
                return {
                    width: 60,
                    height: 45,
                };
            }
        }
    }

    async function init(options) {
        return Workspace.init(options);
    }

    exports.Workspace = Workspace;
    exports.init = init;

}));
