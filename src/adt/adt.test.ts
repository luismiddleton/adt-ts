import { describe, expect, it } from "vitest";
import { ADT, defineADT, matchTagged, matchTaggedPartial, tag, type ADTUnion } from "./adt";

type ShapeSpec = {
  Circle: { radius: number };
  Rectangle: { width: number; height: number };
  Point: Record<string, never>;
};

const Shape = ADT.define<ShapeSpec>();
type Shape = ADTUnion<ShapeSpec>;

describe("ADT (Tagged Union Factory)", () => {
  it("creates frozen tagged variants via constructors and standalone tag()", () => {
    const circle = Shape.Circle({ radius: 5 });
    const point = Shape.Point();
    const raw = tag("Custom", { id: 1 });

    expect(circle).toEqual({ _tag: "Circle", radius: 5 });
    expect(point).toEqual({ _tag: "Point" });
    expect(raw).toEqual({ _tag: "Custom", id: 1 });
    expect(Object.isFrozen(circle)).toBe(true);
    expect(Object.isFrozen(point)).toBe(true);
    expect(Object.isFrozen(raw)).toBe(true);
  });

  it("provides runtime type guards via .is", () => {
    const rect: Shape = Shape.Rectangle({ width: 4, height: 6 });

    expect(Shape.is.Rectangle(rect)).toBe(true);
    expect(Shape.is.Circle(rect)).toBe(false);
    expect(Shape.is.Point(rect)).toBe(false);

    if (Shape.is.Rectangle(rect)) {
      expect(rect.width * rect.height).toBe(24);
    }
  });

  it("exhaustively matches variants via Shape.match and matchTagged", () => {
    const shapes: Shape[] = [
      Shape.Circle({ radius: 2 }),
      Shape.Rectangle({ width: 3, height: 5 }),
      Shape.Point(),
    ];

    const areas = shapes.map((s) =>
      Shape.match(s, {
        Circle: ({ radius }) => Math.round(Math.PI * radius ** 2),
        Rectangle: ({ width, height }) => width * height,
        Point: () => 0,
      }),
    );

    expect(areas).toEqual([13, 15, 0]);
    expect(
      matchTagged(shapes[2]!, {
        Circle: () => "c",
        Rectangle: () => "r",
        Point: () => "p",
      }),
    ).toBe("p");
  });

  it("partially matches variants with fallback via matchPartial and matchTaggedPartial", () => {
    const circle: Shape = Shape.Circle({ radius: 10 });
    const point: Shape = Shape.Point();

    const format = (s: Shape) =>
      Shape.matchPartial(
        s,
        {
          Circle: ({ radius }) => `circle:${radius}`,
        },
        (unmatched) => `other:${unmatched._tag}`,
      );

    expect(format(circle)).toBe("circle:10");
    expect(format(point)).toBe("other:Point");
    expect(
      matchTaggedPartial<Shape, string, string>(
        defineADT<ShapeSpec>().Rectangle({ width: 1, height: 2 }),
        { Point: () => "pt" },
        (u) => u._tag,
      ),
    ).toBe("Rectangle");
  });
});
