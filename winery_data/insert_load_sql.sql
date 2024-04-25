SELECT * FROM winecellar.winery;

LOAD DATA INFILE 'C:/ProgramData/MySQL/MySQL Server 8.0/Uploads/south africa.csv'
into table winery
FIELDS TERMINATED BY ','
LINES TERMINATED BY '\n'
IGNORE 1 ROWS
(name,region,country)

select * from winery where country = 'Albania'
select distinct country from winery

INSERT IGNORE INTO winery_regions (region, country)
SELECT TRIM(region), TRIM(country)
FROM winery
GROUP BY country, region;

SELECT region_id, region, country
INTO OUTFILE 'C:/ProgramData/MySQL/MySQL Server 8.0/Uploads/winery_regions.csv'
FIELDS TERMINATED BY ','
 from winery_regions ;

select * from winery_regions

SELECT * FROM winery WHERE country like '%United States%';

select * from winery where TRIM(country) = 'Portugal'

UPDATE winery w
SET region_id = (
    SELECT region_id
    FROM winery_regions wr
    WHERE TRIM(wr.region) = TRIM(w.region)
    AND TRIM(wr.country) = TRIM(w.country)
)

select * from winery_regions group by region,country


UPDATE winery
SET country = REPLACE(country, '\r', '') where winery_id =1

select winery_id, name, region, country from winery;

select count(*) from winery

						