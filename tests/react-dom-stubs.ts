/**
 * jsdom does not implement the range-measurement APIs CodeMirror's
 * EditorView uses for layout. Stubbing them lets the view initialize;
 * geometry-dependent behavior (coordinates, tooltips) is NOT testable here.
 */
export function installCodeMirrorDomStubs(): void {
  const rect = {
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON() {
      return {};
    },
  };
  Range.prototype.getBoundingClientRect = () => rect as DOMRect;
  Range.prototype.getClientRects = () =>
    ({
      length: 0,
      item: () => null,
      [Symbol.iterator]: [][Symbol.iterator],
    }) as unknown as DOMRectList;
  if (!document.elementFromPoint) {
    document.elementFromPoint = () => null;
  }
}
