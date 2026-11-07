-- Development-only seed. Apply manually to a local D1 database after migration.
-- These are actual URLs supplied in the project brief; production sync safely upserts over them.
INSERT OR IGNORE INTO portfolio_items (id, canonical_url, source_url, company, category, content_type, platform, favourite, display_order, metadata_fetch_status, last_sheet_sync) VALUES
('cw_seed_1','https://www.rhinoafrica.com/en/tours/serengeti-ngorongoro-zanzibar/2268','https://www.rhinoafrica.com/en/tours/serengeti-ngorongoro-zanzibar/2268','Rhino Africa','web-copy','long-form','',1,0,'pending',datetime('now')),
('cw_seed_2','https://www.rhinoafrica.com/en/tours/explore-maasai-mara-great-migration-mombasa/2267','https://www.rhinoafrica.com/en/tours/explore-maasai-mara-great-migration-mombasa/2267','Rhino Africa','web-copy','long-form','',1,1,'pending',datetime('now')),
('cw_seed_3','https://www.rhinoafrica.com/en/accommodation/silvan-safari/28239','https://www.rhinoafrica.com/en/accommodation/silvan-safari/28239','Rhino Africa','web-copy','short-form','',1,2,'pending',datetime('now')),
('cw_seed_4','https://www.rhinoafrica.com/en/accommodation/jack-s-camp/24524','https://www.rhinoafrica.com/en/accommodation/jack-s-camp/24524','Rhino Africa','web-copy','short-form','',1,3,'pending',datetime('now')),
('cw_seed_5','https://www.rhinoafrica.com/en/destinations/tsavo-national-park/21727','https://www.rhinoafrica.com/en/destinations/tsavo-national-park/21727','Rhino Africa','web-copy','informational','',1,4,'pending',datetime('now')),
('cw_seed_6','https://www.rhinoafrica.com/en/destinations/lower-zambezi-national-park/2939','https://www.rhinoafrica.com/en/destinations/lower-zambezi-national-park/2939','Rhino Africa','web-copy','informational','',1,5,'pending',datetime('now')),
('cw_seed_7','https://travelchasers.com/en-za/blog/mind-the-gap-europe-differences-tips','https://travelchasers.com/en-za/blog/mind-the-gap-europe-differences-tips/','Travel Chasers','blog','blog','',1,6,'pending',datetime('now')),
('cw_seed_8','https://www.instagram.com/p/DfJ5JmJDFf-','https://www.instagram.com/p/DfJ5JmJDFf-/','','social-media','social-post','Instagram',1,7,'pending',datetime('now'));
