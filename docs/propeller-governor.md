# Propeller governor model

The propeller control selects a speed. The simulation adjusts actual blade angle to change aerodynamic load, and the balance between driving torque and propeller load changes actual RPM. Blade angle, shaft speed, the instruments, and the rendered blades share that state.

## Rotation and pitch convention

Aircraft forward is the model's negative X direction; normal propeller slipstream travels aft in positive X. The output shaft, reduction carriers, and propeller rotate together about negative X (clockwise when viewed from the rear). At positive blade pitch, the advancing blade edge is toward the nose, so the blade's motion drives air aft. The propeller's cambered face also curves toward the nose, consistent with forward thrust. Reverse changes the blade angle and axial airflow without reversing shaft rotation. The gas generator rotates in the opposite direction. Study animation retains the existing slowed shaft-speed ratios.

The supplied manual defines directions as viewed from the rear on page 2 and describes counterclockwise compressor rotation in its Compressor Turbine Rotor Assembly section. A geometric regression check verifies the direction of blade motion against the actual rendered pitch on all four blades, including fine forward pitch and reverse. This sign check supplements the angle readout; it is not a calibrated aerodynamic calculation.

## Control behavior

| Condition | Simulated action | Expected response |
| --- | --- | --- |
| Actual RPM below selected RPM | Supply control oil and move toward finer pitch | Reduce propeller load so it can accelerate |
| Actual RPM above selected RPM | Drain control oil and move toward coarser pitch | Increase propeller load so it can slow |
| Actual RPM near selected RPM | Hold or make small corrections to blade angle | Absorb the available power near the selected RPM |
| Fine-pitch stop reached | Prevent further forward-range pitch reduction | Actual RPM may stay below the selected RPM at low power |
| Feather selected | Drain control oil and move toward the feather stop | Blade angle increases and propeller RPM falls over time |
| Return from feather | Supply oil as pressure becomes available | Unfeather gradually, then resume speed governing |
| Beta selected | Control blade angle in the ground range | RPM responds to power and load rather than being forced to the forward-mode setpoint |
| Reverse selected | Use negative blade angle and the Nf fuel governor | Reverse slipstream direction and limit speed through fuel reduction |

At a fixed power setting, lowering the RPM selection initially creates an overspeed relative to the new selection. The governor increases blade angle until the output assembly slows. Increasing power at a held RPM requires a coarser angle to absorb the added torque. A fine-pitch stop limits governing authority at low power; a selected RPM is a request, not a guaranteed actual RPM.

Feather is separate from fuel cutoff. The gas generator and free power turbine have separate shafts, so a running gas generator can remain lit while the propeller slows in feather. Shutdown removes fuel and lets both assemblies coast down. Feathering and unfeathering change pitch over time rather than teleporting the blade angle or setting RPM directly.

The primary propeller governor controls pitch. The separate overspeed governor can demand coarser pitch above its protective threshold. The Nf governor limits power-turbine speed by reducing the fuel supplied through the FCU; its simulated fuel reduction also affects gas-generator output. These are distinct actions. In reverse, the primary governor remains in an underspeed condition and supplies oil while the beta mechanism controls pitch and the Nf governor controls speed.

## Sources and their scope

The user supplied **United Turbine, PT6 Training Manual**, 64 pages. PDF page numbers match the printed “Page N of 64” numbers. The source PDF is not included in this repository.

- **Page 2, Engine Description:** separate gas-generator and power-turbine assemblies; the engine oil system supplies power for propeller pitch control.
- **Pages 40-41, Fuel Control System:** the governor package includes the primary constant-speed unit (CSU), reversing valve, and Nf governor. During reverse the Nf section controls power-turbine speed.
- **Page 45, Power Turbine (Nf) Governor:** an overspeed opens a pneumatic bleed, lowers Py pressure, and reduces FCU fuel flow. It describes approximately 6% above the selected propeller speed with the air-bleed link at maximum, approximately 4% below it at minimum, and reverse governing approximately 5% below the propeller selection.
- **Pages 48-50, Acceleration / Reverse Thrust Operation / Power Turbine Limiting:** the propeller absorbs additional power while holding selected speed; reverse links pitch and engine power; Nf corrections change fuel flow. The “Governing” paragraph on page 49 describes the FCU's fuel governor, not the CSU's hydraulic pitch control.
- **Page 51, Propeller Governor Lever:** the lever selects propeller RPM and its maximum decrease position commands feather. This app exposes feather as an explicit mode instead of reproducing cockpit lever detents.
- **Page 58, Operating Problems:** distinguishes prompt feather response from slower unfeathering, with a generic 30-second normal unfeathering reference. It also distinguishes primary, pneumatic, and overspeed-governor faults.
- **Page 62, High Oil Temperature:** describes reduced oil-cooler airflow when idling in feather, consistent with feather not requiring gas-generator shutdown.

The supplied manual does not fully explain the hydraulic CSU's direction of action. That relationship is supported by [Hartzell Propeller Owner's Manual 139, Revision 24, March 2026](https://hartzellprop.com/MANUALS/139-0000-A.pdf):

- **Printed page 2-8 (PDF page 72):** supplying oil decreases blade angle; draining oil allows spring and counterweight forces to increase it.
- **Printed page 2-9 (PDF page 73):** in reverse, the underspeeding governor supplies oil and the beta valve controls blade angle.
- **Printed page 2-29 (PDF page 93):** on-speed, underspeed, and overspeed operation of the governor.
- **Printed page 2-30 (PDF page 94):** feathering releases control oil so the blades can move toward feather.

These references support the direction and separation of the control actions. They do not establish a specific propeller installation, blade-angle calibration, or transient response for this app.

## Simulation assumptions

The application continues to identify its architecture as a King Air 350 / PT6A-60A and retains its existing 1,050 shp baseline, 1,100-1,700 RPM selection range, and 1,500 RPM initial setting. The supplied manual spans many PT6 variants: its earlier-engine 2,200 RPM and PT6A-41/-42 2,000 RPM references are not used as this model's propeller speed. Its page 9 model summary also lists different -60A power ratings; this change does not reconcile or recalibrate those ratings.

| Parameter | Model choice | Status |
| --- | --- | --- |
| Forward fine-pitch stop | 15 degrees | Illustrative |
| Feather stop | 84 degrees | Illustrative |
| Maximum reverse pitch | -18 degrees | Illustrative |
| Normal Nf protection | 106% of selected RPM | Approximation based on the generic page 45 description |
| Reverse/beta Nf governing | 95% of selected RPM | Generic page 45 reverse approximation, also applied to beta as a simplification |
| Separate overspeed governor | 104% of the 1,700 RPM model maximum | Simulation assumption, not a value established by the supplied manual |
| Inertia, aerodynamic load, oil response, and pitch rates | Simplified dynamic calculations | Illustrative, not fitted to test data |

The numerical solver uses bounded substeps so the response remains stable across display frame rates. Oil action is an explanatory state; the model does not solve real pump, valve, and propeller-cylinder hydraulics. Beta/reverse mode controls simplify the aircraft's power-lever and feedback linkages. No aircraft airspeed or full blade-element aerodynamic model is solved, so slipstream graphics indicate direction and relative activity rather than calibrated thrust or drag.

## Checking the behavior

Run `npm test` for the simulation regression suite. Useful interactive checks are lowering and raising selected RPM at steady power, changing power with RPM held, finding the low-power fine-stop limit, cycling feather and governed forward, selecting beta/reverse, and restarting after shutdown. Observe blade angle, actual RPM, oil action, and governor status together.

All values and controls are educational. They are not operating limits, aircraft procedures, maintenance instructions, or a validated flight-dynamics model.
