# PT6A Engine Lab

An interactive, self-contained WebGL 2 educational cutaway of the King Air 350's PT6A-60A turboprop engine.

## Explore

- Orbit with dragging; zoom with the wheel or a two-finger pinch; pan with Shift+drag or the right mouse button.
- The focused canvas supports arrow keys to orbit and + / − to zoom.
- Inspect 14 assemblies from the stage list or select the labels on the model.
- Switch cutaway / exterior / X-ray, isolate an assembly, reveal shafts, or separate the assemblies.
- Six combustor views show steady flame, fuel spray, light-off, recirculation, cooling air, and the reverse gas path.
- Replay the illustrative engine start, change power demand or selected propeller RPM, and shut down.
- Explore a working propeller governor: actual RPM feeds back into blade pitch, which changes propeller load. Watch blade angle, oil action, and RPM respond together.
- Select feather, beta, or reverse in the Propeller governor panel beneath the engine controls. Feather drains control oil and slows the propeller while the gas generator can keep running; unfeathering needs oil pressure and takes time.

## Try the governor

At steady power in governed forward mode, lower the selected RPM. The governor coarsens the blades, increasing their load until actual RPM settles near the new setting. Raise power with the RPM setting unchanged and watch pitch increase to absorb the added power. At low power the blades can reach their fine stop before the selected RPM is reached.

Select feather and watch the blades move toward the feather stop and the propeller slow. Return to governed forward mode to see oil pressure move the blades back toward their governing range. Beta and reverse use blade-angle control; in reverse, the power-turbine governor limits speed by reducing fuel.

These are simulator experiments. See [Propeller governor model](docs/propeller-governor.md) for the control relationships, sources, and assumptions.

## Scope and accuracy

The architecture represents three axial compressor stages, one centrifugal impeller, a diffuser, an annular reverse-flow combustor, one compressor turbine, two free power-turbine stages, two-stage planetary reduction, and a four-blade propeller. The two main shafts are separate. The reduction ratio is approximately 17.6:1.

All geometry is schematic. Dimensions, blade profiles and counts, passage shapes, casing details, and accessory arrangements are not manufacturer CAD. Air and flame particles illustrate processes rather than fluid or chemical simulations. Instrument values and transients use a simplified illustrative model; they are not operational limits, measured performance, flight procedures, or maintenance guidance. Study rotation is intentionally far slower than actual rotor speed.

The Model notes dialog contains source links and limitations. The propeller model uses illustrative pitch limits, load, inertia, and response rates. It retains the app's existing PT6A-60A baseline and 1,100-1,700 RPM control range; general PT6 training-manual percentages are not aircraft-specific rigging data.

## Validation

Run `npm test` (or `node --test tests/*.test.js`) for the simulation regression tests. The governor checks exercise RPM selection, changing power, the fine-pitch stop, feathering and unfeathering, reverse operation, speed protection, and timestep behavior. Browser interaction and visual inspection remain separate checks.

This project is independent of Pratt & Whitney and Textron Aviation.
