import React, { CSSProperties } from "react";

export type SnapPoint = {
  val: number;
  ref?: any;
};

export const toSnapPoint = (val: SnapPoint | number): SnapPoint => {
  if (typeof val === "number") {
    return { val, ref: null };
  } else {
    return val;
  }
};

const snapToPoint = (target: number, points: SnapPoint[]): SnapPoint => {
  return points.length ? points.reduce((point, closest) => {
    return Math.abs(closest.val - target) < Math.abs(point.val - target)
      ? closest
      : point;
  }) : { val: target };
};

const snapToGrid = (gridSize: [number, number], x: number, y: number) => {
  const [gridX, gridY] = gridSize;
  const snappedX = Math.round(x / gridX) * gridY;
  const snappedY = Math.round(y / gridX) * gridY;
  return [snappedX, snappedY];
};

export type OnDragStop = (e: {
  x: number;
  y: number;
  deltaX: number;
  deltaY: number;
}) => boolean | void

const DEFAULT_GRID_SIZE: [number, number] = [1, 1]
const DEFAULT_SHOULD_SNAP = (e: MouseEvent) => true;

export type Props = {
  onDragStop?: OnDragStop;
  snapping?: {
    gridSize?: [number, number];
    shouldSnap?: (e: MouseEvent) => boolean;
    snapPoints?: SnapPoint[][];
    snapDistance?: number;
    snapLines?: (lines: {
      left: SnapPoint | null;
      top: SnapPoint | null;
      dragging: boolean;
      isTarget: boolean;
      key: string;
    }) => React.ReactChild;
    crosshairs?: boolean;
    showAllSnapLines?: boolean;
  };
  dragStyles?: (canDrag: boolean) => CSSProperties;
  initialX?: number,
  initialY?: number,
};

type State = {
  left: number;
  top: number;
  snappedLeft: SnapPoint | null;
  snappedTop: SnapPoint | null;
  moveStart: { x: number; y: number; top: number; left: number } | null;
};

export class Draggable extends React.Component<Props, State> {
  state: State = {
    left: this.props.initialX || 0,
    top: this.props.initialY || 0,

    snappedLeft: null,
    snappedTop: null,

    moveStart: null,
  };

  mouseDown = (e: React.MouseEvent) => {
    if (this.state.moveStart) {
      // if we get stuck in the middle of move, we might receive:
      // moveMove, mouseDown, mouseUp
      //
      // don't touch left and top if we were already a mouse move
      return;
    }

    const { left, top } = this.state;
    window.addEventListener("mousemove", this.mouseMove);

    this.setState({
      moveStart: { x: e.clientX, y: e.clientY, left, top },
    });
  };

  mouseMove = (e: MouseEvent) => {
    if (!this.state.moveStart) {
      return;
    }

    let top, left;

    top = this.state.moveStart.top + (e.clientY - this.state.moveStart.y);
    left = this.state.moveStart.left + (e.clientX - this.state.moveStart.x);

    if (this.props.snapping && (this.props.snapping.shouldSnap !== undefined ? this.props.snapping.shouldSnap : DEFAULT_SHOULD_SNAP)(e)) {
      [top, left] = snapToGrid(this.props.snapping.gridSize || DEFAULT_GRID_SIZE, top, left);
    }

    let { snappedLeft, snappedTop } = this.state;

    const { snapping } = this.props;
    if (snapping && snapping.snapPoints) {
      [snappedTop, snappedLeft] = [
        snapToPoint(top, snapping.snapPoints[0].map(toSnapPoint)),
        snapToPoint(left, snapping.snapPoints[1].map(toSnapPoint)),
      ];

      if (snapping.crosshairs) {
        // we should show regardless of snapping
        [snappedTop, snappedLeft] = [toSnapPoint(top), toSnapPoint(left)];
      }

      if (!snapping.snapDistance) {
        throw new Error("snapDistanace must be provided if using snapPoints");
      }

      [top, left] = [
        Math.abs(snappedTop.val - top) <= snapping.snapDistance
          ? snappedTop.val
          : top,
        Math.abs(snappedLeft.val - left) <= snapping.snapDistance
          ? snappedLeft.val
          : left,
      ];
    }

    this.setState({
      top,
      left,
      snappedLeft: snappedLeft && snappedLeft.val === left ? snappedLeft : null,
      snappedTop: snappedTop && snappedTop.val == top ? snappedTop : null,
    });
  };

  mouseUp = (e: React.MouseEvent) => {
    window.removeEventListener("mousemove", this.mouseMove);
    if (!this.state.moveStart) {
      return;
    }

    const moveStart = this.state.moveStart;

    const completedDrag =
      this.props.onDragStop &&
      this.props.onDragStop({
        x: this.state.left,
        y: this.state.top,
        deltaX: this.state.left - moveStart.left,
        deltaY: this.state.top - moveStart.top,
      });

    if (completedDrag === false) {
      this.setState({
        left: moveStart.left,
        top: moveStart.top,
        snappedLeft: null,
        snappedTop: null,
        moveStart: null,
      });
    } else {
      this.setState({
        moveStart: null,
        snappedLeft: null,
        snappedTop: null,
      });
    }
  };

  get isDragging() {
    return Boolean(this.state.moveStart);
  }

  render() {
    const { top, left } = this.state;
    const { dragStyles, snapping, children } = this.props;

    const snapLines: React.ReactChild[] = [];
    if (snapping && snapping.snapLines) {
      const buildSnapLine = snapping.snapLines;

      if (snapping.showAllSnapLines && snapping.snapPoints) {
        snapLines.push(
          ...snapping.snapPoints[0].map((top) =>
            buildSnapLine({
              key: `-${top.val}`,
              left: null,
              top: top,
              dragging: this.isDragging,
              isTarget: this.state.snappedTop
                ? top.val === this.state.snappedTop.val
                : false,
            })
          )
        );

        snapLines.push(
          ...snapping.snapPoints[1].map((left) =>
            buildSnapLine({
              key: `${left.val}-`,
              left,
              top: null,
              dragging: this.isDragging,
              isTarget: this.state.snappedLeft
                ? left.val === this.state.snappedLeft.val
                : false,
            })
          )
        );
      } else {
        snapLines.push(
          buildSnapLine({
            key: `${(this.state.snappedLeft || { val: "" }).val}-${
              (this.state.snappedTop || { val: "" }).val
            }}`,
            left: this.state.snappedLeft,
            top: this.state.snappedTop,
            dragging: this.isDragging,
            isTarget: true,
          })
        );
      }
    }

    return (
      <div>
        <div
          style={{
            left,
            top,
            position: "absolute",            

            userSelect: "none",
            MozUserSelect: "none",
            WebkitUserSelect: "none",

            ...(dragStyles ? dragStyles(this.isDragging) : {}),
          }}
          onMouseDown={this.mouseDown}
          onMouseUp={this.mouseUp}
        >
          {children}
        </div>
        <div
          style={{
            position: "fixed",
            transform: "translateX(1)",
          }}
        >
          {snapLines}
        </div>
      </div>
    );
  }
}
