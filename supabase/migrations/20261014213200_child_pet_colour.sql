-- The child's character (pet_type: rabbit, robot, fox, dino, dragon) comes in colours.
-- pet_color is the colour option's name in lower case; null is the character's original colours.
alter table public.children add column if not exists pet_color text;

-- Older pet_type values (fox, penguin, ...) have drawn as Biscuit since the pets were replaced.
-- Now that fox is a character again, settle them on the rabbit so nobody's pet changes.
update public.children set pet_type = 'rabbit' where pet_type is distinct from 'rabbit';
