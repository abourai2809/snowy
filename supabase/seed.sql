insert into public.roles (id, label) values
  ('admin', 'Admin'),
  ('store_manager', 'Store Manager'),
  ('lab_manager', 'Lab Manager'),
  ('store_staff', 'Store Staff'),
  ('lab_staff', 'Lab Staff')
on conflict (id) do update set label = excluded.label;

insert into public.locations (id, name, type, capacity) values
  ('lab', 'Lab / Kitchen', 'lab', null),
  ('rajpur', 'Rajpur Road', 'store', 16),
  ('malsi', 'Malsi', 'store', 9),
  ('mussoorie', 'Mussoorie', 'store', 12)
on conflict (id) do update
set name = excluded.name,
    type = excluded.type,
    capacity = excluded.capacity,
    active = true,
    updated_at = now();

insert into public.users (name, phone, role, default_location_id, salary_amount, salary_type, allowed_holidays_per_month, active) values
  ('Arjun Sharma', '9876543210', 'admin', null, 60000, 'monthly', 0, true),
  ('Priya Mehta', '9812345678', 'store_manager', 'rajpur', 25000, 'monthly', 0, true),
  ('Rahul Gupta', '9823456789', 'lab_manager', 'lab', 30000, 'monthly', 0, true),
  ('Sneha Joshi', '9834567890', 'store_staff', 'malsi', 800, 'daily', 0, true),
  ('Vikram Singh', '9845678901', 'lab_staff', 'lab', 700, 'daily', 0, true),
  ('Meera Rawat', '9856789012', 'store_manager', 'mussoorie', 22000, 'monthly', 0, true)
on conflict (phone) do update
set name = excluded.name,
    role = excluded.role,
    default_location_id = excluded.default_location_id,
    salary_amount = excluded.salary_amount,
    salary_type = excluded.salary_type,
    active = excluded.active,
    updated_at = now();

insert into public.holiday_policies (user_id, allowed_holidays_per_month, bonus_days_balance)
select u.id, u.allowed_holidays_per_month, 0
from public.users u
on conflict do nothing;

insert into public.flavours (name, short_code, seasonal, sorbet) values
  ('Lemon Mint Sorbet', 'LEM', false, true),
  ('Bubblegum', 'BUB', false, false),
  ('Peanut Butter', 'PEA', false, false),
  ('Oreo', 'ORE', false, false),
  ('Caramalised Banana', 'CAR', false, false),
  ('Kit Kat', 'KIT', false, false),
  ('Tender Coconut', 'TEN', false, false),
  ('Black Sesame', 'BLA', false, false),
  ('Seasonal Lychee', 'LYC', true, false),
  ('Davidoff Coffee', 'DAV', false, false),
  ('Roasted Almond', 'ROA', false, false),
  ('Apple Cinnamon Pie', 'APP', false, false),
  ('French Vanilla', 'FRE', false, false),
  ('Mix Berry Sorbet', 'MIX', false, true),
  ('Popcorn', 'POP', false, false),
  ('Salted Malted Cookie Dough', 'SMC', false, false),
  ('Seasonal Chikoo', 'CHI', true, false),
  ('Mango Alphonso', 'MAN', false, false),
  ('Premium Dark Choc Fudge Brownie', 'DFB', false, false),
  ('Rhododendron Sorbet', 'RHO', true, true),
  ('Pineapple Compote', 'PIN', false, false),
  ('Strawberry Matcha Latte', 'SML', false, false),
  ('Lotus Biscoff', 'LOT', false, false),
  ('Seasonal Custard Apple', 'CUS', true, false),
  ('Callebaut Belgian Chocolate', 'CBC', false, false),
  ('Mandarin Orange', 'MOR', false, false),
  ('Tiramisu', 'TIR', false, false),
  ('Strawberry Cheesecake', 'STC', false, false),
  ('Ferrero', 'FER', false, false),
  ('Salted Butter Caramel', 'SBC', false, false),
  ('Sugar Free Dairy Free Chocolate', 'SFD', false, false),
  ('Pure Sicilian Pistachio', 'PSP', false, false)
on conflict (name) do update
set short_code = excluded.short_code,
    seasonal = excluded.seasonal,
    sorbet = excluded.sorbet,
    active = true,
    updated_at = now();

insert into public.catalog_categories (category_key, name, item_kind, scope) values
  ('raw-materials', 'Raw Materials', 'raw_material', 'lab'),
  ('lab-supplies', 'Lab Supplies', 'supply', 'lab'),
  ('store-supplies', 'Store Supplies', 'supply', 'store'),
  ('packaging-serving', 'Packaging / Serving Supplies', 'packaging', 'both'),
  ('products-sold', 'Products Sold', 'product', 'store')
on conflict (category_key) do update
set name = excluded.name,
    item_kind = excluded.item_kind,
    scope = excluded.scope,
    active = true,
    updated_at = now();

insert into public.catalog_items (item_key, category_id, name, item_kind, scope, unit, default_min_qty)
select v.item_key, c.id, v.name, v.item_kind::public.catalog_item_kind, v.scope::public.catalog_scope, v.unit, v.default_min_qty
from (values
  ('raw-full-cream-milk', 'raw-materials', 'Full Cream Milk', 'raw_material', 'lab', 'litres', 30),
  ('raw-fresh-cream', 'raw-materials', 'Fresh Cream', 'raw_material', 'lab', 'litres', 15),
  ('raw-sugar', 'raw-materials', 'Sugar', 'raw_material', 'lab', 'kg', 20),
  ('raw-pistachio-paste', 'raw-materials', 'Pistachio Paste', 'raw_material', 'lab', 'kg', 5),
  ('raw-cocoa-powder', 'raw-materials', 'Cocoa Powder', 'raw_material', 'lab', 'kg', 4),
  ('raw-vanilla-extract', 'raw-materials', 'Vanilla Extract', 'raw_material', 'lab', 'ml', 200),
  ('raw-stabiliser-mix', 'raw-materials', 'Stabiliser Mix', 'raw_material', 'lab', 'g', 200),
  ('lab-gelato-containers-500ml', 'lab-supplies', 'Gelato Containers 500ml', 'supply', 'lab', 'pcs', 50),
  ('lab-gelato-containers-1l', 'lab-supplies', 'Gelato Containers 1L', 'supply', 'lab', 'pcs', 30),
  ('lab-piping-bags', 'lab-supplies', 'Piping Bags', 'supply', 'lab', 'pcs', 40),
  ('lab-hairnets', 'lab-supplies', 'Hairnets', 'supply', 'lab', 'pcs', 20),
  ('lab-gloves-pairs', 'lab-supplies', 'Gloves (pairs)', 'supply', 'lab', 'pairs', 25),
  ('lab-food-safe-cling-wrap', 'lab-supplies', 'Food-safe Cling Wrap', 'supply', 'lab', 'rolls', 3),
  ('store-single-use-cups', 'store-supplies', 'Single Use Cups', 'packaging', 'store', 'pcs', 200),
  ('store-napkins', 'store-supplies', 'Napkins', 'supply', 'store', 'pcs', 500),
  ('store-waffle-cones', 'store-supplies', 'Waffle Cones', 'product', 'store', 'pcs', 100),
  ('store-waffle-mix', 'store-supplies', 'Waffle Mix', 'raw_material', 'store', 'kg', 3)
) as v(item_key, category_key, name, item_kind, scope, unit, default_min_qty)
join public.catalog_categories c on c.category_key = v.category_key
on conflict (item_key) do update
set name = excluded.name,
    category_id = excluded.category_id,
    item_kind = excluded.item_kind,
    scope = excluded.scope,
    unit = excluded.unit,
    default_min_qty = excluded.default_min_qty,
    active = true,
    updated_at = now();

insert into public.raw_materials (catalog_item_id)
select id from public.catalog_items
where item_kind = 'raw_material'
on conflict do nothing;

insert into public.supplies (catalog_item_id)
select id from public.catalog_items
where item_kind in ('supply', 'packaging')
on conflict do nothing;

insert into public.products (product_key, name, catalog_item_id, scope, track_inventory)
select 'store-waffle-cone', 'Waffle Cone', ci.id, 'store', true
from public.catalog_items ci
where ci.item_key = 'store-waffle-cones'
on conflict (product_key) do update
set name = excluded.name,
    catalog_item_id = excluded.catalog_item_id,
    scope = excluded.scope,
    track_inventory = excluded.track_inventory,
    active = true,
    updated_at = now();

insert into public.inventory_balances (location_id, catalog_item_id, quantity, min_qty)
select v.location_id, ci.id, v.quantity, v.min_qty
from (values
  ('lab', 'raw-full-cream-milk', 120, 30),
  ('lab', 'raw-fresh-cream', 45, 15),
  ('lab', 'raw-sugar', 80, 20),
  ('lab', 'raw-pistachio-paste', 8, 5),
  ('lab', 'raw-cocoa-powder', 3.5, 4),
  ('lab', 'raw-vanilla-extract', 900, 200),
  ('lab', 'raw-stabiliser-mix', 500, 200),
  ('lab', 'lab-gelato-containers-500ml', 200, 50),
  ('lab', 'lab-gelato-containers-1l', 100, 30),
  ('lab', 'lab-piping-bags', 150, 40),
  ('lab', 'lab-hairnets', 50, 20),
  ('lab', 'lab-gloves-pairs', 80, 25),
  ('lab', 'lab-food-safe-cling-wrap', 8, 3),
  ('rajpur', 'store-single-use-cups', 800, 200),
  ('rajpur', 'store-napkins', 2000, 500),
  ('rajpur', 'store-waffle-cones', 300, 100),
  ('rajpur', 'store-waffle-mix', 8, 3),
  ('malsi', 'store-single-use-cups', 400, 150),
  ('malsi', 'store-napkins', 900, 300),
  ('malsi', 'store-waffle-mix', 2.5, 3),
  ('mussoorie', 'store-single-use-cups', 600, 200),
  ('mussoorie', 'store-napkins', 1500, 400),
  ('mussoorie', 'store-waffle-mix', 4, 3)
) as v(location_id, item_key, quantity, min_qty)
join public.catalog_items ci on ci.item_key = v.item_key
on conflict (location_id, catalog_item_id) do update
set quantity = excluded.quantity,
    min_qty = excluded.min_qty,
    updated_at = now();
