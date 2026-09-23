# Airflow during power changes

## Source findings

The supplied United Turbine PT6 Training Manual describes the following normal behavior. PDF and printed page numbers agree; the source document is not distributed in this repository.

- Pages 2-4 and 17 establish the path from the rear inlet through the compressor, impeller, diffuser, combustor, turbines, and exhaust. The reverse-flow combustion chamber has fixed turns in that path. A normal power reduction does not send the core stream back out through the inlet.
- Page 49, Deceleration, describes a lower power setting reducing FCU governor spring force and Py pressure. Metered fuel decreases, with a minimum-flow stop protecting against flameout. The gas generator decelerates toward its new equilibrium.
- Pages 27 and 29-30 describe low-speed anti-stall protection: the compressor bleed valve discharges interstage air to atmosphere and progressively closes as speed rises. That side discharge is distinct from reversing the core stream.
- Pages 48-49 distinguish fuel-controlled engine acceleration from propeller loading and reverse-thrust operation. Changing propeller pitch does not reverse the core gas path.
- Pages 59-60 list compressor stall and flameout as abnormal operating problems. They are not the intended result of ordinary power-lever movements.

Reverse airflow is not physically impossible under every condition. The [FAA Aviation Maintenance Technician Handbook - Powerplant, chapter 3, page 3-16](https://www.faa.gov/sites/faa.gov/files/05_amtp_ch3.pdf) describes stopped or reversed airflow during compressor stall. This educational model does not solve compressor maps, surge, stall, or calibrated bleed-valve operation. No fault behavior is added by this animation correction.

## Animation correction

Previously, particle position used `elapsedTime * currentSpeed`. When Ng decreased, that expression recalculated all previous travel at the lower speed. Its apparent velocity included an erroneous `elapsedTime * speedChange` term, which could become negative and grew worse the longer the model had been running.

Core and flame particle travel now accumulates each frame's `speed * dt`. Changing power affects subsequent travel while preserving particle position. Bounded phases wrap only to recycle particles at the end of a path. The core always advances along the established, folded streamline while the gas generator turns; it slows during deceleration and stops when Ng reaches zero. Study playback speed scales travel without changing its direction.

Flame intensity controls brightness and visible downstream extent. A shorter flame fades or extinguishes downstream particles instead of pulling them upstream. Propeller slipstream travel is accumulated separately, with direction taken from actual blade pitch. Selecting reverse cannot change core flow or instantly relocate the propeller's particles.

Tests exercise rendered particle coordinates after an hour of accumulated runtime, repeated power changes using the engine simulation, deceleration and acceleration, stationary redraws, playback changes, paused redraws, flame shortening, and forward/reverse propeller transitions. The manual establishes the physical relationships; particle velocities and appearance remain illustrative.
