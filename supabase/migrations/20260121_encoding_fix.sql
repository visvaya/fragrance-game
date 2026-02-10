-- Fix perfumes.name
UPDATE perfumes
SET 
  name = regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(name, 'Ă®', 'î', 'g'), 'Ă´', 'ô', 'g'), 'Ăą', 'à', 'g'), 'Ă©', 'é', 'g'), 'Ă¨', 'è', 'g'), 'Ăª', 'ê', 'g')
WHERE name ~ 'Ă[®´ąéèê]';

-- Fix brands.name
UPDATE brands
SET 
  name = regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(name, 'Ă®', 'î', 'g'), 'Ă´', 'ô', 'g'), 'Ăą', 'à', 'g'), 'Ă©', 'é', 'g'), 'Ă¨', 'è', 'g'), 'Ăª', 'ê', 'g')
WHERE name ~ 'Ă[®´ąéèê]';
