# Food composition master

Source: 日本食品標準成分表（八訂）増補2023年（文部科学省）

The application nutrition master is derived from the official MEXT food-composition data.
Values are per 100 g edible portion. AI is used only to identify/normalize foods and estimate
portion size; AI-generated nutrient values are not accepted as authoritative values.

Source page: https://www.mext.go.jp/a_menu/syokuhinseibun/mext_00001.html

Update policy:
- Base table: 八訂・増補2023年
- Apply published MEXT errata before regenerating the master.
- As of 2026-06-09, the MEXT Food Composition Database reflects the 2026-03-27 errata.
- Unmapped foods MUST NOT be treated as 0 kcal or omitted from a displayed meal total.
- Store food number, official food name, aliases, kcal, protein, fat, carbohydrate, fiber and salt.
