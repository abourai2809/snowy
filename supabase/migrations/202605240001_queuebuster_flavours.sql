with mapped_flavours(old_name, name, short_code, seasonal, sorbet) as (
  values
    ('Seasonal Chikoo', 'CHIKOO', 'CHI', true, false),
    ('Salted Malted Cookie Dough', 'SALTED MALTED CHOCO-CHIP COOKIE DOUGH', 'SMC', false, false),
    ('Callebaut Belgian Chocolate', 'BELGIAN CHOCOLATE', 'BEL', false, false),
    ('Strawberry Cheesecake', 'STRAWBERRY CHEESE CAKE', 'STC', false, false),
    ('Davidoff Coffee', 'COFFEE', 'COF', false, false),
    ('Pure Sicilian Pistachio', 'PISTACHTO', 'PIS', false, false),
    ('Lotus Biscoff', 'LOTUS BISCOFF', 'LOT', false, false),
    ('French Vanilla', 'VANIGLIA', 'VAN', false, false),
    ('Roasted Almond', 'ROASTED ALMOND', 'ROA', false, false),
    ('Pineapple Compote', 'PINEAPPLE', 'PIN', false, false),
    ('Lemon Mint Sorbet', 'LEMON MINT', 'LEM', false, true),
    ('Ferrero', 'FERRERO ROCHER', 'FER', false, false),
    ('Mandarin Orange', 'MANDARIN', 'MND', false, false),
    ('Salted Butter Caramel', 'SALTED BUTTER CARAMEL', 'SBC', false, false),
    ('Tiramisu', 'TIRAMISU', 'TIR', false, false),
    ('Premium Dark Choc Fudge Brownie', 'CHOCOLATE FUDGE BROWNIE', 'CFB', false, false),
    ('Rhododendron Sorbet', 'SPICED RHODODENDRON', 'SPI', true, true),
    ('Mix Berry Sorbet', 'MIXED BERRY SORBET', 'MIX', false, true),
    ('Mango Alphonso', 'MANGO', 'MNG', false, false),
    ('Sugar Free Dairy Free Chocolate', 'NO ADDED SUGAR - CHOCOLATE', 'NAS', false, false),
    ('Apple Cinnamon Pie', 'CINAMMON APPLE PIE', 'CIN', false, false),
    ('Popcorn', 'POPCORN', 'POP', false, false),
    ('Peanut Butter', 'PEANUT BUTTER GELATO', 'PEA', false, false),
    ('Seasonal Lychee', 'LYCHEE', 'LYC', true, false)
),
desired_flavours(name, short_code, seasonal, sorbet) as (
  values
    ('CHIKOO', 'CHI', true, false),
    ('SALTED MALTED CHOCO-CHIP COOKIE DOUGH', 'SMC', false, false),
    ('BELGIAN CHOCOLATE', 'BEL', false, false),
    ('STRAWBERRY CHEESE CAKE', 'STC', false, false),
    ('COFFEE', 'COF', false, false),
    ('PISTACHTO', 'PIS', false, false),
    ('LOTUS BISCOFF', 'LOT', false, false),
    ('LAVENDER MASCARPONE', 'LAV', false, false),
    ('VANIGLIA', 'VAN', false, false),
    ('ROASTED ALMOND', 'ROA', false, false),
    ('PINEAPPLE', 'PIN', false, false),
    ('LEMON MINT', 'LEM', false, true),
    ('PAHADI TULSI', 'PAH', false, false),
    ('FERRERO ROCHER', 'FER', false, false),
    ('MANDARIN', 'MND', false, false),
    ('ORANGE PINEAPPLE', 'ORP', false, false),
    ('SALTED BUTTER CARAMEL', 'SBC', false, false),
    ('TIRAMISU', 'TIR', false, false),
    ('CHOCOLATE FUDGE BROWNIE', 'CFB', false, false),
    ('MASALA GUAVA', 'MAS', false, false),
    ('BLUEBERRY YOGURT', 'BLU', false, false),
    ('SPICED RHODODENDRON', 'SPI', true, true),
    ('MIXED BERRY SORBET', 'MIX', false, true),
    ('MANGO', 'MNG', false, false),
    ('NO ADDED SUGAR - CHOCOLATE', 'NAS', false, false),
    ('CINAMMON APPLE PIE', 'CIN', false, false),
    ('POPCORN', 'POP', false, false),
    ('PEANUT BUTTER GELATO', 'PEA', false, false),
    ('LYCHEE', 'LYC', true, false),
    ('BLACK CURRANT', 'BLC', false, false)
),
renamed as (
  update public.flavours f
  set name = m.name,
      short_code = m.short_code,
      seasonal = m.seasonal,
      sorbet = m.sorbet,
      active = true,
      updated_at = now()
  from mapped_flavours m
  where f.name = m.old_name
  returning f.id
),
updated_current as (
  update public.flavours f
  set short_code = d.short_code,
      seasonal = d.seasonal,
      sorbet = d.sorbet,
      active = true,
      updated_at = now()
  from desired_flavours d
  where f.name = d.name
  returning f.id
)
insert into public.flavours (name, short_code, seasonal, sorbet, active)
select d.name, d.short_code, d.seasonal, d.sorbet, true
from desired_flavours d
where not exists (
  select 1 from public.flavours f
  where f.name = d.name or f.short_code = d.short_code
);

with desired_flavours(name) as (
  values
    ('CHIKOO'),
    ('SALTED MALTED CHOCO-CHIP COOKIE DOUGH'),
    ('BELGIAN CHOCOLATE'),
    ('STRAWBERRY CHEESE CAKE'),
    ('COFFEE'),
    ('PISTACHTO'),
    ('LOTUS BISCOFF'),
    ('LAVENDER MASCARPONE'),
    ('VANIGLIA'),
    ('ROASTED ALMOND'),
    ('PINEAPPLE'),
    ('LEMON MINT'),
    ('PAHADI TULSI'),
    ('FERRERO ROCHER'),
    ('MANDARIN'),
    ('ORANGE PINEAPPLE'),
    ('SALTED BUTTER CARAMEL'),
    ('TIRAMISU'),
    ('CHOCOLATE FUDGE BROWNIE'),
    ('MASALA GUAVA'),
    ('BLUEBERRY YOGURT'),
    ('SPICED RHODODENDRON'),
    ('MIXED BERRY SORBET'),
    ('MANGO'),
    ('NO ADDED SUGAR - CHOCOLATE'),
    ('CINAMMON APPLE PIE'),
    ('POPCORN'),
    ('PEANUT BUTTER GELATO'),
    ('LYCHEE'),
    ('BLACK CURRANT')
)
update public.flavours f
set active = false,
    updated_at = now()
where not exists (
  select 1 from desired_flavours d
  where d.name = f.name
);
