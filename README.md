# PT6A Engine Lab

An interactive, self-contained WebGL 2 educational cutaway of the King Air 350's PT6A-60A turboprop engine.

## Explore

- Orbit with dragging; zoom with the wheel or a two-finger pinch; pan with Shift+drag or the right mouse button.
- The focused canvas supports arrow keys to orbit and + / − to zoom.
- Inspect 14 assemblies from the stage list or select the labels on the model.
- Switch cutaway / exterior / X-ray, isolate an assembly, reveal shafts, or separate the assemblies.
- Six combustor views show steady flame, fuel spray, light-off, recirculation, cooling air, and the reverse gas path.
- Replay the illustrative engine start, change power demand or governed propeller speed, and shut down.
- The propeller stage offers forward, feather, and reverse geometry studies.

## Scope and accuracy

The architecture represents three axial compressor stages, one centrifugal impeller, a diffuser, an annular reverse-flow combustor, one compressor turbine, two free power-turbine stages, two-stage planetary reduction, and a four-blade propeller. The two main shafts are separate. The reduction ratio is approximately 17.6:1.

All geometry is schematic. Dimensions, blade profiles and counts, passage shapes, casing details, and accessory arrangements are not manufacturer CAD. Air and flame particles illustrate processes rather than fluid or chemical simulations. Instrument values and transients use a simplified illustrative model; they are not operational limits, measured performance, flight procedures, or maintenance guidance. Study rotation is intentionally far slower than actual rotor speed.

The Model notes dialog contains source links and limitations.

## Validation

Run `npm test` (or `node --test tests/*.test.js`) to check startup order, independent coastdown, governing behavior, torque/power consistency, geometry indices and finite transforms, flow continuity, display-mode traversal, and static control references.

This project is independent of Pratt & Whitney and Textron Aviation.
