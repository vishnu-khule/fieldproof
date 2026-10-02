# Reusable Remodel Estimate Formula Model
This file captures the formula logic studied from the client-prepared Sturgeon estimate workbook. It is intended to be reused for future remodel quotations. It records the **calculation structure only**, not the client dollar amounts.
## 1. Workbook Organization Pattern
| Area | Purpose | Formula Behavior |
|---|---|---|
| Labor sections | Each trade/category has a heading row with labor rates in columns B:D and a section total row. | Labor subtotal is calculated from entered quantities/hours multiplied by the rate cells in the section heading row. |
| Materials sections | Each matching trade/category has material line items and one material subtotal. | Material subtotal is a direct `SUM()` of material cost input rows. |
| Category Totals | Each category links its labor subtotal and material subtotal. | Category total = labor subtotal + material subtotal. |
| Final Totals | Total cost, O&P, and final project cost are calculated from category totals. | O&P = subtotal × 20%; final = subtotal + O&P. |
## 2. Labor Section Formula Pattern
For every labor category:

```excel
General Labor Total = SUM(general_labor_quantity_rows) * General_Labor_Rate
Specialty/Electrical Labor Total = SUM(specialty_labor_quantity_rows) * Specialty_Labor_Rate
Subcontractor/Unit Labor Total = SUM(subcontractor_quantity_rows) * Subcontractor_Rate
Labor Category Total = SUM(General Labor Total : Subcontractor/Unit Labor Total)
```

Original workbook pattern example:

```excel
B14 = SUM(B8:B13) * B7
C14 = SUM(C8:C13) * C7
D14 = SUM(D8:D13) * D7
E14 = SUM(B14:D14)
```
## 3. Material Section Formula Pattern
For every material category:

```excel
Material Category Total = SUM(material_cost_input_rows)
```

Original workbook pattern examples:

```excel
B225 = SUM(B221:B224)
B237 = SUM(B228:B236)
B408 = SUM(B381:B407)
```
## 4. Category Summary Link Pattern
Each category summary row links one labor subtotal and one material subtotal:

```excel
Category Labor = Labor Section Total Cell
Category Materials = Material Section Total Cell
Category Total = SUM(Category Labor : Category Materials)
```

Original workbook pattern example:

```excel
B416 = SUM(E14)
C416 = SUM(B225)
D416 = SUM(B416:C416)
```
## 5. Final Total Formula Pattern
```excel
Total Labor = SUM(all category labor cells)
Total Materials = SUM(all category material cells)
Subtotal Before O&P = SUM(Total Labor : Total Materials)
Overhead/Profit = Subtotal Before O&P * 20%
Total Project Cost = Subtotal Before O&P + Overhead/Profit
```

Original workbook pattern:

```excel
B439 = SUM(B416:B438)
C439 = SUM(C416:C438)
D439 = SUM(B439:C439)
D440 = PRODUCT(D439) * 0.2
D441 = SUM(D439:D440)
```
## 6. Required Category List
Use all of these categories in the same order unless a future client template uses a different order. Do not remove a category just because the direct amount is zero; keep the section and mark it as `Included elsewhere`, `No direct cost`, or `Verify`.

1. Site Preparation
2. Foundation
3. Demolition
4. Framing
5. Exterior Finishes
6. Siding
7. Windows/Doors
8. Roofing
9. Rough Plumbing
10. Rough Electrical
11. Mechanical
12. Insulation
13. Drywall
14. Trim/Casework/Hardware
15. Tiling/Counters/Flooring
16. Paint Interior
17. Paint Exterior
18. Finish Plumbing
19. Finish Electrical
20. Appliances
21. Clean Up
22. Allowances
23. Permits

## 7. Quotation Rules Based on This Formula Model
- Do **not** combine categories in the final summary if the client formula model separates them.
- Do **not** hide zero-value sections; retain them with a note explaining why no direct cost is entered.
- Keep allowances separate from trade labor/materials when the drawing shows an item but final product selections are not fixed.
- Place finish selections such as windows, tile, glass, fixtures, hardware, lighting, water heater, and appliances in `Allowances` when the model treats purchases separately from install labor.
- Labor formulas should multiply entered quantities/hours/units by the applicable category rate; materials formulas should sum direct input costs only.
- Category totals must reference linked labor and material subtotals, not independently retyped values.
- O&P must be applied once at the end to the full subtotal.
- If a drawing section has no direct line item, list it in the coverage audit and show where it is carried.
