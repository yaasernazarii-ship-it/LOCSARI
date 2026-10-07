alter table advertisements
  alter column price type numeric(20,2) using price::numeric(20,2),
  alter column deposit type numeric(20,2) using deposit::numeric(20,2),
  alter column monthly_rent type numeric(20,2) using monthly_rent::numeric(20,2);
