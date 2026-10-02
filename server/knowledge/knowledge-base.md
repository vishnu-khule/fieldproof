# Generic Remodeling Estimate Formula Knowledge Base

This document is a reusable estimating framework for converting residential remodel drawings into a contractor-style estimate.  
It is intentionally generic and can be applied to any residential remodel, alteration, addition, bathroom remodel, kitchen remodel, structural remodel, or exterior scope.

The purpose of this document is to preserve the **formula logic**, **category rollup behavior**, **rate usage**, and **drawing extraction method** learned from prior client workbooks, without copying project-specific dollar amounts.

---

# 1. Core Rule

Do **not** copy dollar amounts from a client workbook unless the task is explicitly to compare against that workbook.

Use client workbooks only to learn:

1. Category structure.
2. How detailed line items roll into category totals.
3. Which items are treated as labor, material, specialty/subcontractor, or allowance.
4. Which labor rates are used.
5. Whether purchases are carried inside a category or separated into allowances.
6. Whether O&P is applied to all categories or only selected categories.

The actual estimate must be generated from the drawings.

---

# 2. Rate Structure

## 2.1 Preferred Client-Learned Rates

When estimating for this client/template, use the following learned rates unless a newer actual workbook overrides them.

| Rate Type | Rate | Use For |
|---|---:|---|
| General labor / carpenter labor | **$120/hr** | Site prep, protection, demolition, framing, drywall support, trim, cleanup, general remodel labor |
| Electrical / skilled specialty labor | **$165/hr** | Rough electrical, finish electrical, lighting, switches, outlets, fans, controls, specialty skilled labor |
| Specialty production unit | **$200/unit or hr-equivalent** | Roofing, mechanical/HVAC production, tile production, exterior specialty work, excavation/demo production units, subcontractor-type work |
| Overhead & Profit | **20%** | Applied to subtotal before final total |

## 2.2 Fallback Rates When No Client Rate Exists

Use these only when no client-specific actual workbook exists.

| Rate Type | Fallback Range |
|---|---:|
| General labor | $105/hr to $120/hr |
| Electrical / specialty labor | $150/hr to $165/hr |
| Specialty production unit | $200/unit |
| O&P | 20% |

## 2.3 Rate Selection Rules

1. Use the **latest actual workbook from the same client** when available.
2. If a newer actual workbook uses a different general labor rate, update the preferred rate.
3. If a newer actual workbook uses a different electrical/specialty rate, update the preferred rate.
4. If a newer actual workbook uses a different O&P rate, update the preferred O&P.
5. Do not mix rates from unrelated clients unless explicitly instructed.
6. Do not use national average pricing when a client-specific rate structure is available.

---

# 3. Universal Line Item Formula

Every detailed line item should follow this format:

```text
Labor Cost = Labor Hours × Applicable Labor Rate

Material Cost = Material Quantity × Material Unit Cost
OR
Material Cost = Material Allowance

Specialty Cost = Specialty Units × Specialty Unit Rate

Line Total = Labor Cost + Material Cost + Specialty Cost
```

When using a two-column summary with only Labor and Materials:

```text
Labor Column = Direct labor cost
Materials Column = Materials + specialty/subcontractor + allowances assigned to that category
Total Column = Labor Column + Materials Column
```

---

# 4. Category Rollup Formula

Each category total is calculated from its line items.

```text
Category Labor = SUM(all direct labor line items in that category)

Category Materials = SUM(
    all materials
  + all specialty production costs
  + all subcontractor allowances
  + all purchase allowances assigned to that category
)

Category Total = Category Labor + Category Materials
```

Project total:

```text
Subtotal Before O&P = SUM(all category totals)

O&P = Subtotal Before O&P × 20%

Total Project Cost = Subtotal Before O&P + O&P
```

---

# 5. Standard Category Summary Format

Use this category list unless the user requests another structure.

| Category |
|---|
| Site Preparation |
| Foundation |
| Demolition |
| Framing |
| Exterior Finishes |
| Siding |
| Windows/Doors |
| Roofing |
| Rough Plumbing |
| Rough Electrical |
| Mechanical |
| Insulation |
| Drywall |
| Trim/Casework/Hardware |
| Tiling/Counters/Flooring |
| Paint Interior |
| Paint Exterior |
| Finish Plumbing |
| Finish Electrical |
| Appliances |
| Clean Up |
| Allowances |
| Permits |
| Total Cost |
| Overhead/Profit |
| Total Project Cost |

---

# 6. Required Drawing Review Sequence

Before estimating, review every drawing section. Do not skip sheets because they appear administrative. Administrative sheets often create cost obligations.

## 6.1 Permit / Administrative Pages

Look for:
- Smoke and carbon monoxide alarm requirements.
- Stormwater BMP requirements.
- Lead-safe work practice requirements.
- Construction site security.
- Conditions of approval.
- Noise limits for heat pump / condenser.
- Preconstruction inspection requirements.
- Required documents on site.
- Local reach code requirements.
- Electrification requirements.
- Waste management.

Cost categories affected:
- Site Preparation.
- Rough Electrical.
- Finish Electrical.
- Mechanical.
- Insulation.
- Clean Up.
- Allowances.

## 6.2 Cover / Site Plan / Project Data

Extract:
- Address.
- Permit number.
- Project type.
- Existing area.
- Addition area.
- Remodel/alteration area.
- Number of stories affected.
- Lot access constraints.
- Side yard or rear yard constraints.
- Exterior work zones.
- Scope summary.
- Required code upgrades.

Cost categories affected:
- Site Preparation.
- Demolition.
- Foundation.
- Framing.
- Exterior Finishes.
- Roofing.
- Siding.
- Mechanical.

## 6.3 Existing / Demolition Plans

Extract:
- Walls removed.
- Openings enlarged.
- Doors removed.
- Windows removed.
- Fixtures removed.
- Cabinets removed.
- Stairs removed.
- Flooring removed.
- Ceiling/plaster areas opened.
- MEP demolition.
- Structural items to remain or be modified.

Cost categories affected:
- Demolition.
- Framing.
- Rough Plumbing.
- Rough Electrical.
- Drywall.
- Clean Up.

## 6.4 Proposed Floor Plans

Extract:
- New walls.
- New rooms.
- New bathrooms.
- New kitchen/pantry/laundry areas.
- New stairs.
- New closets.
- Door and window locations.
- Plumbing fixture locations.
- Appliance locations.
- Mechanical equipment.
- Electrical symbols.
- Flooring notes.
- Cabinets and built-ins.
- Decks and exterior stairs.

Cost categories affected:
- Nearly all categories.

## 6.5 Reflected Ceiling Plans

Extract:
- Recessed lights.
- Surface lights.
- Pendants.
- Sconces.
- Exhaust fans.
- Skylights.
- Ceiling framing changes.
- Ceiling patching.
- Vacancy sensors.
- Dimmers.
- Separate fan switching.
- Attic access.

Cost categories affected:
- Framing.
- Rough Electrical.
- Finish Electrical.
- Mechanical.
- Drywall.
- Paint Interior.
- Roofing if skylights penetrate roof.

## 6.6 Interior Elevations

Extract:
- Vanity sizes.
- Shower tile height.
- Shower glass.
- Shower niches.
- Tub/shower type.
- Mirrors.
- Medicine cabinets.
- Cabinets.
- Shelves.
- Rods.
- Built-ins.
- Trim.
- Tile extents.
- Countertops.
- Hardware.

Cost categories affected:
- Trim/Casework/Hardware.
- Tiling/Counters/Flooring.
- Finish Plumbing.
- Finish Electrical.
- Allowances.

## 6.7 Door and Window Schedules

Extract:
- Door count.
- Window count.
- New vs existing vs relocated.
- Material.
- Size.
- Tempered/safety glazing.
- Fire rating.
- Exterior vs interior.
- Hardware type.
- Flashing requirements.
- Special preconstruction inspections.

Cost categories affected:
- Windows/Doors.
- Exterior Finishes.
- Siding.
- Drywall.
- Paint Interior.
- Paint Exterior.
- Allowances.

## 6.8 Exterior Elevations

Extract:
- Siding repair.
- Stucco patch.
- Trim patch.
- Exterior paint.
- Roofing patch.
- Gutters/downspouts.
- Decks.
- Railings.
- Exterior stairs.
- Condenser screening/conduits.
- Wall penetrations.

Cost categories affected:
- Exterior Finishes.
- Siding.
- Roofing.
- Paint Exterior.
- Mechanical.
- Windows/Doors.

## 6.9 Structural Drawings

Extract:
- Beams.
- Headers.
- Posts.
- Joists.
- Rafters.
- Blocking.
- Shear walls.
- Holdowns.
- Anchor bolts.
- Simpson connectors.
- Floor infill.
- Stair infill.
- Skylight framing.
- Roof framing.
- Foundation modifications.
- Special inspections.
- Structural observations.
- Shoring/bracing responsibilities.

Cost categories affected:
- Foundation.
- Demolition.
- Framing.
- Roofing.
- Drywall.
- Site Preparation.

## 6.10 Title 24 / Energy / CALGreen

Extract:
- Insulation values.
- Water heater type.
- HVAC type.
- HERS verification.
- Pipe insulation.
- Lighting requirements.
- Water fixture requirements.
- Waste management.
- Low-VOC materials.
- Ventilation requirements.

Cost categories affected:
- Mechanical.
- Insulation.
- Rough Electrical.
- Finish Electrical.
- Finish Plumbing.
- Clean Up.
- Allowances.

---

# 7. Category Formula Details

## 7.1 Site Preparation

Include:
- Mobilization.
- Interior protection.
- Floor protection.
- Dust barriers.
- Temporary plastic walls.
- Ram board.
- Site access protection.
- Stormwater BMPs.
- Porta potty.
- Security/fencing if required.
- Lead-safe setup for pre-1978 buildings.
- Required preconstruction inspection coordination.

Formula:

```text
Site Prep Labor =
  mobilization_hours
+ protection_hours
+ BMP_setup_hours
+ site_security_setup_hours
+ preconstruction_coordination_hours
+ lead_safe_setup_hours

Site Prep Materials =
  floor_protection_materials
+ dust_barrier_materials
+ BMP_materials
+ temp_facility_allowance
+ security_materials
+ lead_safe_materials
```

Typical ranges:
- Small room remodel: 12–24 GL hours.
- Bathroom remodel: 16–32 GL hours.
- Multi-room interior remodel: 32–60 GL hours.
- Addition / exterior remodel: 60–120 GL hours.
- Complex occupied remodel: add 10–25% protection labor.

---

## 7.2 Foundation

Include only when drawings show foundation, concrete, footing, pier, slab, curb, or crawlspace structural work.

Formula:

```text
Foundation Labor =
  layout_hours
+ excavation_hours
+ forming_hours
+ rebar_hours
+ concrete_place_finish_hours
+ strip_cleanup_hours

Foundation Materials =
  concrete
+ rebar
+ form_materials
+ anchor_bolts
+ holdown_embeds
+ gravel
+ vapor_barrier
+ pump_or_delivery
```

Rules:
- If no foundation work is shown: $0.
- Do not invent foundation scope just because framing changes.
- Small concrete patch/curb: 8–24 GL hours.
- Small footing/stem wall: 24–60 GL hours.
- Addition foundation: calculate from footing length, pier count, slab area, and structural details.
- Specialty excavation/concrete may be carried as $200 production units in Materials column.

---

## 7.3 Demolition

Include:
- Wall demolition.
- Cabinet demolition.
- Fixture demolition.
- Flooring removal.
- Door/window removal.
- Stair removal.
- Ceiling/plaster opening.
- Selective roof/siding demo.
- Hauling and dump fees.

Formula:

```text
Demolition Labor =
  wall_demo_hours
+ fixture_demo_hours
+ cabinet_demo_hours
+ floor_demo_hours
+ stair_demo_hours
+ ceiling_opening_hours
+ exterior_demo_hours
+ load_out_hours

Demolition Materials =
  dumpsters
+ dump_fees
+ bags
+ blades
+ protection_consumables
```

Rules:
- Follow demolition notes only.
- Do not assume full gut unless drawings show full gut.
- Structural demo requires extra labor for shoring and careful removal.
- Existing plaster houses require higher demo and patch labor.

---

## 7.4 Framing

Include:
- New walls.
- Wall infill.
- Beam/header installation.
- Posts.
- Blocking.
- Floor framing.
- Ceiling framing.
- Roof framing.
- Stair framing/infill.
- Skylight framing.
- Structural connector installation.

Formula:

```text
Framing Labor =
  new_wall_hours
+ beam_header_install_hours
+ post_install_hours
+ blocking_hours
+ floor_framing_hours
+ ceiling_roof_framing_hours
+ stair_infill_hours
+ skylight_framing_hours
+ connector_install_hours

Framing Materials =
  lumber
+ engineered_lumber
+ plywood/sheathing
+ hangers/connectors
+ straps
+ fasteners
+ adhesive
```

Rules:
- For remodels, price only altered/strengthened areas.
- Do not price full-room framing if only walls are moved.
- Structural sheets control beam/header/post scope.
- Skylights require roof/ceiling framing plus drywall and roofing categories.

---

## 7.5 Exterior Finishes

Include:
- Exterior trim.
- Decks.
- Railings.
- Exterior stairs.
- Waterproofing at exterior penetrations.
- Exterior patch carpentry.
- Porch/stair repairs.

Formula:

```text
Exterior Finish Labor =
  deck_repair_hours
+ stair_hours
+ railing_hours
+ exterior_trim_hours
+ exterior_patch_hours
+ waterproofing_hours

Exterior Finish Materials =
  decking
+ railing_materials
+ stair_materials
+ exterior_trim
+ flashing
+ sealants
```

Rules:
- Keep siding in Siding category.
- Keep roofing in Roofing category.
- Use this category for exterior carpentry and finish details not otherwise classified.

---

## 7.6 Siding

Include:
- Siding removal/patch.
- WRB.
- Flashing behind siding.
- Exterior wall patch after window/door/HVAC work.
- Siding trim if directly tied to siding.

Formula:

```text
Siding Labor =
  siding_demo_patch_hours
+ WRB_hours
+ flashing_hours
+ siding_install_hours
+ trim_blend_hours

Siding Materials =
  siding_material
+ WRB
+ flashing
+ fasteners
+ caulk
```

Rules:
- If only minor penetrations/patches exist, keep siding low.
- Do not price full elevations unless drawings show full siding replacement.

---

## 7.7 Windows / Doors

Include:
- Installation labor.
- Flashing.
- Interior/exterior trim labor.
- Hardware installation.
- Preconstruction inspection coordination if required.

Formula:

```text
Windows/Doors Labor =
  window_install_hours
+ door_install_hours
+ flashing_hours
+ trim_hours
+ hardware_hours
+ inspection_coordination_hours

Windows/Doors Materials =
  flashing
+ foam
+ sealant
+ trim_material
+ hardware
+ purchase_allowance_if_carried_in_category
```

Rules:
- If client template puts window/door purchases in Allowances, keep only install/flash/trim labor here.
- Exterior doors require flashing and exterior patching.
- Relocated windows need removal, storage/protection, reframing, reinstall, and patching.
- Tempered/safety glazing may increase allowance.

---

## 7.8 Roofing

Include:
- Roof patch.
- Skylight roof integration.
- Flashing.
- Underlayment.
- Shingle/tile patch.
- Gutters/downspouts.
- Roof penetrations.

Formula:

```text
Roofing Labor =
  roof_demo_patch_hours
+ skylight_flashing_hours
+ underlayment_hours
+ roof_finish_hours
+ gutter_hours

Roofing Materials =
  roofing_material
+ underlayment
+ flashing
+ skylight_flashing_kits
+ gutters/downspouts
```

Rules:
- Skylights always affect roofing unless noted as interior-only light panels.
- Use specialty production units when roofing is subcontracted.
- Do not include skylight purchase here if carried in Allowances.

---

## 7.9 Rough Plumbing

Include:
- Water lines.
- Waste lines.
- Vent lines.
- Gas lines.
- Shower/tub valves.
- Toilet rough-in.
- Lavatory rough-in.
- Laundry rough-in.
- Kitchen rough-in.
- Water heater rough-in.

Formula:

```text
Rough Plumbing Labor =
  fixture_rough_count × hours_per_fixture
+ shower_valve_hours
+ tub_valve_hours
+ water_heater_rough_hours
+ gas_line_hours
+ inspection_hours

Rough Plumbing Materials =
  pipe
+ fittings
+ valves
+ boxes
+ drains
+ vent_materials
+ gas_pipe
```

Typical fixture rough-in guide:
- Lavatory: 3–5 hrs.
- Toilet: 3–5 hrs.
- Shower: 6–10 hrs.
- Tub: 6–10 hrs.
- Kitchen sink: 5–8 hrs.
- Laundry: 5–8 hrs.
- Water heater: 6–12 hrs.
- Gas line modification: 4–10 hrs.

---

## 7.10 Rough Electrical

Include:
- Circuits.
- Boxes.
- Wiring.
- Outlets.
- Switches.
- Recessed lights.
- Surface lights.
- Fans.
- Smoke/CO alarms.
- Subpanel/panel.
- Heated floor controller.
- HVAC electrical rough-in.
- Appliance circuits.

Formula:

```text
Rough Electrical Labor =
  outlets × outlet_hours × electrical_rate
+ switches × switch_hours × electrical_rate
+ lights × light_hours × electrical_rate
+ fans × fan_hours × electrical_rate
+ circuits × circuit_hours × electrical_rate
+ panel_hours × electrical_rate
+ alarm_count × alarm_hours × electrical_rate

Rough Electrical Materials =
  wire
+ boxes
+ breakers
+ devices
+ cans
+ fan_housings
+ controls
```

Typical device hours:
- Outlet: 1.0–1.5 hrs.
- Switch: 1.0–1.5 hrs.
- Recessed light: 1.5–2.0 hrs.
- Surface light box: 1.0–1.5 hrs.
- Bath fan rough-in: 2–4 hrs.
- Smoke/CO alarm: 1–1.5 hrs.
- New circuit: 2–4 hrs.
- Subpanel/panel work: 8–16 hrs.

---

## 7.11 Mechanical

Include:
- Heat pump.
- Mini-split.
- Condenser.
- Refrigerant lines.
- Condensate drain.
- Ducting.
- Bath fan ducting.
- Range hood ducting.
- Sound attenuation.
- Concealed/painted conduit/routing.
- Equipment pad/brackets.

Formula:

```text
Mechanical Labor =
  equipment_install_units × specialty_rate
+ line_set_hours
+ duct_hours
+ condensate_hours
+ fan_duct_hours
+ startup_coordination_hours

Mechanical Materials =
  equipment_allowance
+ line_set_materials
+ duct_materials
+ pad/bracket
+ condensate_materials
+ sound_control_allowance
```

Rules:
- If client actual treats HVAC as production units, use $200 specialty units.
- Heat pump equipment purchase may be in Allowances if owner-selected.
- Conditions requiring 50 dB at property line may need sound-control allowance.
- Concealed refrigerant lines/conduits should be included when drawings require concealment.

---

## 7.12 Insulation

Include:
- Wall insulation.
- Floor insulation.
- Attic insulation.
- Roof insulation.
- Pipe insulation.
- Air sealing.
- Reach code insulation requirements.

Formula:

```text
Insulation Labor =
  area × labor_hours_per_sf
OR
  insulation_production_units × specialty_rate

Insulation Materials =
  insulation_material
+ air_sealing_material
+ pipe_insulation
```

Rules:
- Apply Title 24 / energy report values.
- Use only affected areas unless reach code requires whole-house upgrades.
- Raised floor, exterior wall, attic, and roof insulation must be separated.

---

## 7.13 Drywall / Plaster

Include:
- New drywall.
- Plaster repair.
- Ceiling patching.
- Wall patching.
- Skylight shaft finishing.
- Texture match.
- Fire tape under stairs if required.

Formula:

```text
Drywall Labor =
  hang_hours
+ tape_finish_hours
+ plaster_patch_hours
+ ceiling_patch_hours
+ texture_match_hours
+ skylight_shaft_finish_hours

Drywall Materials =
  drywall
+ mud/tape
+ corner bead
+ plaster_material
```

Rules:
- Older plaster homes require higher patch/finish hours.
- Skylights create drywall shaft labor.
- Structural beam installs often create ceiling patching.

---

## 7.14 Trim / Casework / Hardware

Include:
- Baseboard.
- Casing.
- Interior doors.
- Door hardware.
- Closet rods/shelves.
- Cabinets install.
- Built-ins.
- Vanity install if not in bathroom allowance.
- Stair rail/guards if interior.

Formula:

```text
Trim Labor =
  base_lf × base_hours_per_lf
+ casing_lf × casing_hours_per_lf
+ interior_doors × door_hours
+ hardware_count × hardware_hours
+ closet_system_hours
+ cabinet_install_hours
+ built_in_hours

Trim Materials =
  base/casing material
+ doors
+ hardware
+ closet materials
+ cabinet materials if carried here
```

Rules:
- Cabinet purchases often go to Allowances.
- Cabinet installation stays in Trim/Casework unless category is split separately.
- Built-ins from elevations must not be missed.

---

## 7.15 Tiling / Counters / Flooring

Include:
- Bathroom floor tile.
- Shower wall tile.
- Shower pan.
- Waterproofing.
- Heated floor mat.
- Countertops.
- Backsplash.
- Hardwood/floor refinishing.
- New flooring install.

Formula:

```text
Tile/Floor Labor =
  floor_tile_sf × tile_floor_rate_units
+ shower_wall_sf × shower_tile_rate_units
+ shower_pan_count × pan_units
+ waterproofing_units
+ heated_floor_units
+ countertop_install_units
+ flooring_install_or_refinish_units

Tile/Floor Materials =
  thinset
+ grout
+ waterproofing
+ backer board
+ tile allowance if carried here
+ countertop allowance if carried here
+ flooring allowance if carried here
```

Rules:
- Tile/counter/floor material purchases may go to Allowances if owner-selected.
- Heated floor requires both electrical and flooring/tile line items.
- Shower glass is usually Allowance or Finish Plumbing/Trim depending template.

---

## 7.16 Paint Interior

Include:
- Wall paint.
- Ceiling paint.
- Trim paint.
- Door paint.
- Patch blending.
- Prime new drywall/plaster.

Formula:

```text
Interior Paint Labor =
  rooms_affected × room_paint_hours
+ trim_paint_hours
+ ceiling_paint_hours
+ patch_blend_hours

Interior Paint Materials =
  paint_materials if not embedded in labor
```

Rules:
- If client template carries paint as labor-only production, put material as $0.
- Multi-room remodel requires affected-room painting, not just new walls.
- Drywall/plaster patch areas usually require full plane repaint.

---

## 7.17 Paint Exterior

Include:
- Exterior patch paint.
- Siding paint.
- Trim paint.
- Door/window exterior paint.
- Railing/deck stain or paint if not carried in Exterior Finishes.

Formula:

```text
Exterior Paint Labor =
  exterior_patch_area_hours
+ trim_paint_hours
+ siding_paint_hours
+ railing_stain_hours

Exterior Paint Materials =
  paint/stain/sealant if not embedded in labor
```

Rules:
- Do not price full exterior repaint unless drawings show it.
- Exterior patching around windows/doors/HVAC penetrations requires paint blending.

---

## 7.18 Finish Plumbing

Include:
- Set toilet.
- Set lavatory faucet.
- Set shower trim.
- Set tub trim.
- Set kitchen faucet.
- Set laundry fixtures.
- Set water heater.
- Final testing.

Formula:

```text
Finish Plumbing Labor =
  toilet_count × set_hours
+ faucet_count × set_hours
+ shower_trim_count × set_hours
+ tub_trim_count × set_hours
+ water_heater_finish_hours
+ final_test_hours

Finish Plumbing Materials =
  fixture_allowances_if_carried_here
+ supply_lines
+ traps
+ valves
+ caulk
```

Rules:
- Fixture purchases often go to Allowances.
- Finish labor must remain even when fixtures are owner supplied.

---

## 7.19 Finish Electrical

Include:
- Install fixtures.
- Install switches.
- Install outlets.
- Install dimmers/sensors.
- Install fans.
- Install smoke/CO alarms.
- Install heated floor controls.
- Final labeling/testing.

Formula:

```text
Finish Electrical Labor =
  device_count × device_trim_hours × electrical_rate
+ fixture_count × fixture_install_hours × electrical_rate
+ fan_count × fan_finish_hours × electrical_rate
+ controls_count × controls_hours × electrical_rate
+ final_test_hours × electrical_rate

Finish Electrical Materials =
  plates
+ dimmers
+ sensors
+ alarms
+ fixture allowance if carried here
```

Rules:
- Light fixture purchases often go to Allowances.
- Vacancy sensors and dimmers are code-driven and should be included.

---

## 7.20 Appliances

Include only if appliances are included in contractor scope.

Formula:

```text
Appliance Labor =
  appliance_count × install_hours × applicable_rate

Appliance Materials =
  appliance_allowance_if_contractor_supplied
+ connection_kits
```

Rules:
- If appliances are owner-supplied, include install/coordination only if contractor installs.
- If no appliance scope appears in drawings, use $0.

---

## 7.21 Clean Up

Include:
- Final clean.
- Dump run.
- Debris load-out.
- Punch cleanup.
- Construction vacuuming.

Formula:

```text
Cleanup Labor =
  cleanup_hours × general_labor_rate

Cleanup Materials =
  dumpster_final
+ dump_fees
+ cleaning_consumables
```

Typical:
- Small bathroom remodel: 8–16 GL hours.
- Multi-room remodel: 16–32 GL hours.
- Addition/major remodel: 32–60 GL hours.

---

## 7.22 Allowances

Use allowances for owner-selected or not-yet-specified products.

Typical allowances:
- Windows.
- Exterior doors.
- Interior doors.
- Skylights.
- Plumbing fixtures.
- Tile material.
- Countertops.
- Cabinets.
- Shower glass.
- Light fixtures.
- HVAC equipment.
- Appliances.
- Specialty hardware.
- Permit/design fees if not otherwise carried.

Formula:

```text
Allowance Total =
  SUM(owner_selected_product_allowances)
+ SUM(unspecified_product_allowances)
+ SUM(client-template allowance items)
```

Rules:
- Do not double count items in both category materials and allowances.
- If purchase is in Allowances, category should carry installation labor only.
- Clearly separate allowance purchase from labor to install.

---

## 7.23 Permits

Include only if contractor carries permit cost.

Formula:

```text
Permits = permit_fee_allowance + inspection_fee_allowance + special_agency_fee_allowance
```

Rules:
- If permits are owner-paid, use $0.
- Special inspections/structural observations may be under Site Prep, Foundation, Framing, or Allowances depending template.

---

# 8. Drawing-to-Estimate Mapping Rules

## 8.1 Bathroom Remodel

Always check for:
- Demo.
- Rough plumbing.
- Rough electrical.
- Exhaust fan and duct.
- Shower waterproofing.
- Tile floor.
- Shower tile.
- Vanity/cabinet.
- Counter.
- Toilet.
- Faucets/trim.
- Mirror/medicine cabinet.
- Shower glass/door.
- Lighting.
- GFCI.
- Heated floor if shown.
- Drywall/plaster.
- Paint.
- Accessories.

Categories affected:
- Site Preparation.
- Demolition.
- Framing.
- Rough Plumbing.
- Rough Electrical.
- Mechanical.
- Insulation if exterior walls/floor/ceiling opened.
- Drywall.
- Trim/Casework/Hardware.
- Tiling/Counters/Flooring.
- Paint Interior.
- Finish Plumbing.
- Finish Electrical.
- Allowances.
- Clean Up.

## 8.2 Kitchen Remodel

Always check for:
- Cabinet demo.
- Appliance demo.
- Sink/faucet/disposal.
- Gas/electric range.
- Hood/duct.
- Cabinets.
- Counters.
- Backsplash.
- Lighting.
- Under-cabinet lights.
- GFCI/AFCI.
- Flooring.
- Drywall/paint.
- Window/door changes.

## 8.3 Bedroom Remodel

Always check for:
- Door/window changes.
- Closet changes.
- Electrical.
- Lighting.
- Smoke alarm.
- Flooring/refinish.
- Drywall/plaster.
- Paint.
- HVAC supply/return or mini-split.

## 8.4 Stair Removal or Infill

Always check for:
- Demo.
- Temporary protection.
- Floor framing infill.
- Guard/rail removal.
- Wall/ceiling patch.
- Drywall/plaster.
- Flooring patch/refinish.
- Paint.
- Structural details.

## 8.5 Skylights

Always check for:
- Purchase allowance.
- Roof opening.
- Rafter/joist framing.
- Header/blocking/hangers.
- Roof flashing.
- Roofing patch.
- Light shaft drywall.
- Interior paint.
- Exterior waterproofing.
- Structural review if rafters interrupted.

## 8.6 Heat Pump / Mini-Split

Always check for:
- Equipment purchase or allowance.
- Condenser placement.
- Line-set routing.
- Electrical circuit.
- Condensate drain.
- Wall/roof penetration.
- Concealed/painted conduits.
- Sound requirements.
- Pad/bracket.
- Startup/testing.
- Rebate note if applicable, but do not deduct rebate unless requested.

---

# 9. Avoiding Common Estimating Errors

1. Do not price full foundation if no foundation is shown.
2. Do not price full framing if only selective framing is shown.
3. Do not skip administrative pages; they can create site prep, electrical, mechanical, or code costs.
4. Do not double count product purchases in both category materials and Allowances.
5. Do not ignore skylight roof and drywall impacts.
6. Do not ignore old plaster repair in older homes.
7. Do not ignore smoke/CO alarms on remodel permits.
8. Do not ignore Title 24 / CALGreen fixture and lighting requirements.
9. Do not assume fixtures are owner-supplied unless template or user says so.
10. Do not carry client actual dollar amounts into a new estimate.
11. Do not decide a section is unimportant without checking it.
12. Mark uncertain quantities as Verify rather than inventing detail.

---

# 10. Summary Table Output Formula

Final user-facing category summary should be:

| Category Totals | Labor | Materials | Totals |
|---|---:|---:|---:|
| Site Preparation | $x | $y | $z |
| Foundation | $x | $y | $z |
| Demolition | $x | $y | $z |
| Framing | $x | $y | $z |
| Exterior Finishes | $x | $y | $z |
| Siding | $x | $y | $z |
| Windows/Doors | $x | $y | $z |
| Roofing | $x | $y | $z |
| Rough Plumbing | $x | $y | $z |
| Rough Electrical | $x | $y | $z |
| Mechanical | $x | $y | $z |
| Insulation | $x | $y | $z |
| Drywall | $x | $y | $z |
| Trim/Casework/Hardware | $x | $y | $z |
| Tiling/Counters/Flooring | $x | $y | $z |
| Paint Interior | $x | $y | $z |
| Paint Exterior | $x | $y | $z |
| Finish Plumbing | $x | $y | $z |
| Finish Electrical | $x | $y | $z |
| Appliances | $x | $y | $z |
| Clean Up | $x | $y | $z |
| Allowances | $0 | $y | $y |
| Permits | $x | $y | $z |
| **Total Cost** | **sum labor** | **sum materials** | **subtotal** |
| Overhead/Profit 20% |  |  | **subtotal × 20%** |
| **Total Project Cost** |  |  | **subtotal + O&P** |

---

# 11. Calibration Workflow After Client Actual Is Provided

When client actual estimate is uploaded:

1. Compare our subtotal before O&P to client subtotal before O&P.
2. Compare category-by-category.
3. Identify categories over/under by percentage.
4. Do not copy client line totals.
5. Update generic formulas only if pattern is reusable.
6. Update client-specific rates if workbook clearly shows rate structure.
7. Add reusable category behavior rules.
8. Preserve project-specific observations separately from generic formula knowledge.

Calibration formula:

```text
Variance = Our Category Total - Client Category Total
Variance % = Variance / Client Category Total
```

Reusable improvements should be written as rules, not project facts.

Example:
- Bad: “For Clowes, reduce windows to $X.”
- Good: “If client template carries window purchases in Allowances, Windows/Doors category should include install/flash/trim labor only.”

---

# 12. Minimum Detail Required Before Summary

Before producing a category summary, create an internal line-item takeoff with:

- Source sheet.
- Scope item.
- Quantity.
- Labor hours.
- Rate.
- Labor cost.
- Material/specialty cost.
- Category.
- Confidence tag.

Then roll it up to the summary table.

---

# 13. Standard Confidence Statement

Every estimate should state:

“This is a drawing-based estimate generated from the provided permit drawings. Quantities are extracted from the drawing set where visible and inferred only where standard construction is required to complete shown work. Product selections, concealed conditions, field verification items, and owner-selected finishes should be confirmed before contract pricing.”

