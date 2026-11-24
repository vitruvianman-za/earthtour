"""Builds Earth Tour's preloaded tours as JSON.
Coordinates come from Wikipedia's coordinate data (checked 24 Nov 2026). Where a site
has no published coordinates, the stop sits at the nearest verified place and is marked
approximate, with a note saying so."""
import json, os, sys

OUT = sys.argv[1]
E, A, D = 'established', 'approximate', 'disputed'

def stop(date, title, place, lat, lng, rng, narration, conf, note, sources):
    return dict(date=date, title=title, place=place, lat=lat, lng=lng, range_m=rng,
                narration=narration, confidence=conf, confidence_note=note,
                sources=sources, geocode_query='', snapped=False)

# ---------- shared sources ----------
LWTF = 'Nelson Mandela, Long Walk to Freedom (1994)'
SAMPSON = 'Anthony Sampson, Mandela: The Authorised Biography (1999)'
HAMILTON = 'Carolyn Hamilton, Terrific Majesty (1998)'
WYLIE = 'Dan Wylie, Myth of Iron: Shaka in History (2006)'
LABAND_ROPE = 'John Laband, Rope of Sand (1995)'
THOMPSON = 'Leonard Thompson, Survival in Two Worlds: Moshoeshoe of Lesotho, 1786-1870 (1975)'
CASALIS = 'Eugene Casalis, The Basutos (1861)'
RASMUSSEN = "R. Kent Rasmussen, Migrant Kingdom: Mzilikazi's Ndebele in South Africa (1978)"
MOFFAT = 'The Matabele Journals of Robert Moffat (1945)'
LABAND_KIC = 'John Laband, Kingdom in Crisis: The Zulu Response to the British Invasion of 1879 (1992)'
GUY = 'Jeff Guy, The Destruction of the Zulu Kingdom (1979)'
KNIGHT = 'Ian Knight, Zulu Rising (2010)'
MEREDITH = 'Martin Meredith, Diamonds, Gold and War (2007)'
VANONSELEN = 'Charles van Onselen, New Babylon, New Nineveh (1982)'
TURRELL = 'Rob Turrell, Capital and Labour on the Kimberley Diamond Fields, 1871-1890 (1987)'
PAKENHAM = 'Thomas Pakenham, The Boer War (1979)'
NASSON = 'Bill Nasson, The South African War, 1899-1902 (1999)'
VANHEYNINGEN = 'Elizabeth van Heyningen, The Concentration Camps of the Anglo-Boer War (2013)'
KESSLER = 'Stowell Kessler, The Black Concentration Camps of the Anglo-Boer War, 1899-1902 (2012)'
NDLOVU = 'Sifiso Mxolisi Ndlovu, The Soweto Uprisings: Counter-memories of June 1976 (1998)'
BROOKS = 'Alan Brooks and Jeremy Brickhill, Whirlwind Before the Storm (1980)'
POHLANDT = 'Helena Pohlandt-McCormick, "I Saw a Nightmare...": Doing Violence to Memory (2005)'
BIKO = 'Steve Biko, I Write What I Like (1978)'
WOODS = 'Donald Woods, Biko (1978)'
MANGCU = 'Xolela Mangcu, Biko: A Biography (2012)'
TRC = 'Truth and Reconciliation Commission of South Africa Report (1998)'
HUFFMAN = 'Thomas Huffman, Mapungubwe: Ancient African Civilisation on the Limpopo (2005)'
PIKIRAYI = 'Innocent Pikirayi, The Zimbabwe Culture (2001)'
AXELSON = 'Eric Axelson, Portuguese in South-East Africa, 1488-1600 (1973)'
BARROS = 'Joao de Barros, Decadas da Asia (1552)'
WELLS = "Julia C. Wells, \"Eva's Men: Gender and Power in the Establishment of the Cape of Good Hope, 1652-74\", Journal of African History (1998)"
ELPHICK = 'Richard Elphick, Khoikhoi and the Founding of White South Africa (1985)'
VRJ = 'The Journal of Jan van Riebeeck (Van Riebeeck Society, 1952-58)'

TOURS = []

def tour(id, title, span, summary, caveat, keywords, stops):
    TOURS.append(dict(id=id, title=title, span=span, summary=summary, caveat=caveat,
                      keywords=keywords, stops=stops, curated=True, generated=False))

# ======================================================================
tour('mandela', "Mandela's long walk", '1918 to 2013, South Africa',
 "Nelson Mandela's life traced from a rural Eastern Cape village to the presidency, through 27 years in prison. It follows the arc of the struggle against apartheid itself.",
 "This is one of the best-documented lives in South African history: Mandela's own autobiography, an authorised biography, court records and press coverage agree on nearly every place and date here.",
 ['mandela', 'madiba', 'long walk'],
 [
  stop('18 July 1918', 'Born in Mvezo', 'Mvezo, Eastern Cape', -31.95, 28.516, 6000,
   "Rolihlahla Mandela was born in this village on the Mbashe River, into a branch of the Thembu royal family. His father lost his position as headman when Mandela was an infant, and the family moved.",
   E, '', [LWTF]),
  stop('1920s', 'Childhood in Qunu', 'Qunu, Eastern Cape', -31.78333333, 28.61666667, 6000,
   "Mandela grew up herding cattle in Qunu and was given the name Nelson by a teacher at the local mission school. After his father died, he went to live under the guardianship of the Thembu regent, Jongintaba.",
   E, '', [LWTF, SAMPSON]),
  stop('1939', 'University of Fort Hare', 'Alice, Eastern Cape', -32.7875, 26.8475, 3000,
   "Fort Hare was one of the few universities open to Black South Africans, and Mandela met Oliver Tambo here. He left in 1940 after joining a student protest and refusing to back down.",
   E, '', [LWTF, SAMPSON]),
  stop('1941', 'Arrives in Johannesburg', 'Alexandra, Johannesburg', -26.10383333, 28.09616667, 5000,
   "Fleeing an arranged marriage, Mandela came to Johannesburg and lived in Alexandra township while working and studying law. Walter Sisulu helped him find work and drew him into the African National Congress.",
   E, '', [LWTF]),
  stop('1946', '8115 Vilakazi Street', 'Orlando West, Soweto', -26.23853611, 27.90877222, 1500,
   "Mandela moved into this small house in Orlando West, his home until his arrest. In 1952 he helped lead the Defiance Campaign and opened South Africa's first Black law firm with Tambo.",
   E, '', [LWTF, SAMPSON]),
  stop('5 August 1962', 'Arrested near Howick', 'outside Howick, KwaZulu-Natal', -29.46666667, 30.23333333, 6000,
   "After 17 months underground, Mandela was stopped at a police roadblock while disguised as a chauffeur. A sculpture of 50 steel columns now marks the capture site beside the road.",
   A, 'The marker shows Howick; the capture site is just outside the town.', [LWTF, SAMPSON]),
  stop('11 July 1963', 'Liliesleaf Farm raid', 'Rivonia, Johannesburg', -26.04388889, 28.05361111, 2500,
   "Police raided this farm, the secret headquarters of the ANC's armed wing, and seized documents that put Mandela, already in prison, on trial with the movement's leadership.",
   E, '', [LWTF, SAMPSON]),
  stop('20 April 1964', 'The Rivonia Trial', 'Palace of Justice, Pretoria', -25.7475, 28.1878, 1500,
   "From the dock, Mandela said democracy and freedom were \"an ideal for which I am prepared to die\". He and seven others were sentenced to life imprisonment in June.",
   E, '', [LWTF, SAMPSON]),
  stop('1964 to 1982', 'Robben Island', 'Robben Island, Table Bay', -33.805, 18.37, 6000,
   "Prisoner 466/64 spent 18 years here, breaking rocks in a lime quarry that damaged his eyes. The island became known as \"the university\": prisoners taught each other in secret.",
   E, '', [LWTF]),
  stop('1982 to 1988', 'Pollsmoor Prison', 'Tokai, Cape Town', -34.06861111, 18.43222222, 2500,
   "Mandela was moved to the mainland with other senior leaders. From here, in 1985, he began secret talks with the government without telling his comrades.",
   E, '', [LWTF, SAMPSON]),
  stop('1988 to 1990', 'Victor Verster Prison', 'near Paarl, Western Cape', -33.84361111, 19.01611111, 3000,
   "His last years in prison were spent in a warder's cottage here, where talks with the government continued. He walked out of its gates on 11 February 1990.",
   E, '', [LWTF]),
  stop('11 February 1990', 'Speech from City Hall', 'Cape Town City Hall', -33.92527778, 18.42388889, 1200,
   "Hours after his release, Mandela spoke from the balcony of City Hall to a crowd on the Grand Parade. He had been in prison for 27 years.",
   E, '', [LWTF, SAMPSON]),
  stop('10 May 1994', 'Inauguration', 'Union Buildings, Pretoria', -25.74046667, 28.21202222, 1500,
   "After the first election open to all South Africans, Mandela was sworn in as president at the Union Buildings, the seat of the government that had imprisoned him.",
   E, '', [LWTF, SAMPSON]),
  stop('15 December 2013', 'Laid to rest in Qunu', 'Qunu, Eastern Cape', -31.78333333, 28.61666667, 6000,
   "Mandela died on 5 December 2013, aged 95, and was buried in the village where he grew up.",
   E, '', [SAMPSON]),
 ])

# ======================================================================
tour('shaka', "Shaka's rise and campaigns", 'c. 1787 to 1828, KwaZulu-Natal',
 "Shaka kaSenzangakhona turned the small Zulu chiefdom into the dominant power between the Phongolo and Thukela rivers in about a decade. His wars and the upheavals around them reshaped south-east Africa.",
 "Almost everything written about Shaka comes from oral traditions recorded decades later and from the accounts of European traders who wanted him to look either fearsome or friendly. Dates before 1824 are approximate, and many famous stories are probably legend.",
 ['shaka', 'zulu kingdom', 'kwabulawayo'],
 [
  stop('c. 1787', 'Born to Nandi', 'near present-day Melmoth, KwaZulu-Natal', -28.58333333, 31.38333333, 25000,
   "Shaka was born to Senzangakhona, chief of the small Zulu clan, and Nandi of the Langeni. The famous story of a bullied, exiled childhood comes mostly from much later tellings.",
   A, 'His birth year and birthplace are estimates; the marker shows the general area.', [HAMILTON, WYLIE]),
  stop('c. 1810', 'Serves under Dingiswayo', 'Mthethwa country, near present-day Mtubatuba', -28.41666667, 32.18333333, 30000,
   "Shaka rose as a warrior in the army of Dingiswayo, ruler of the Mthethwa. When Senzangakhona died around 1816, Dingiswayo backed Shaka to take the Zulu chieftaincy.",
   A, 'The timeline of his service is reconstructed from oral sources.', [LABAND_ROPE, WYLIE]),
  stop('c. 1816', 'Takes the Zulu chieftaincy', 'eMakhosini valley, KwaZulu-Natal', -28.51666667, 31.66666667, 15000,
   "Shaka took control of the Zulu in the eMakhosini, the valley of the Zulu kings, after his half-brother was killed. He began reorganising the army into age regiments.",
   A, 'The year is approximate; the military innovations credited to him are debated.', [HAMILTON, LABAND_ROPE]),
  stop('c. 1818', 'Battle of Gqokli Hill', 'near present-day Ulundi, KwaZulu-Natal', -28.31666667, 31.41666667, 8000,
   "Outnumbered by Zwide's Ndwandwe, Shaka's regiments are said to have held a hilltop and driven the attackers off. It is remembered as the first great test of the new army.",
   D, 'The year, the exact hill and the numbers involved are all debated; the marker shows Ulundi.', [LABAND_ROPE, WYLIE]),
  stop('c. 1819', 'Battle of the Mhlatuze', 'Mhlatuze River, KwaZulu-Natal', -28.8333, 32.0, 25000,
   "After Dingiswayo's death, Shaka defeated the Ndwandwe at the Mhlatuze River. Zwide's people scattered northwards, and the Zulu became the strongest power in the region.",
   A, 'The site and date come from oral tradition.', [LABAND_ROPE]),
  stop('c. 1820', 'KwaBulawayo', 'near present-day Eshowe, KwaZulu-Natal', -28.88833333, 31.44833333, 8000,
   "Shaka's great royal homestead near Eshowe became the centre of the kingdom. Not to be confused with Bulawayo in Zimbabwe, which was named after it decades later.",
   A, 'The marker shows Eshowe; the homestead site lies nearby.', [HAMILTON]),
  stop('1824', 'Traders at Port Natal', 'Port Natal, present-day Durban', -29.88333333, 31.05, 12000,
   "A party of British traders led by Francis Farewell settled at Port Natal with Shaka's permission. Their later writings shaped how the world saw him, often for their own ends.",
   E, '', [HAMILTON, WYLIE]),
  stop('September 1828', 'Killed at Dukuza', 'KwaDukuza, KwaZulu-Natal', -29.33333333, 31.29166667, 6000,
   "Shaka was assassinated at his last royal homestead by his half-brothers Dingane and Mhlangana. Dingane became king.",
   E, '', [LABAND_ROPE]),
 ])

# ======================================================================
tour('moshoeshoe', 'Moshoeshoe and the founding of Lesotho', 'c. 1786 to 1870, Lesotho and the Free State',
 "Moshoeshoe gathered people scattered by the wars of the 1820s into a new nation on a defensible mountain. Through war and diplomacy he kept Basotho independence against Boer and British pressure.",
 "The record combines Sesotho oral tradition with the detailed letters and books of French missionaries who lived at his court from 1833, so later events are well documented and earlier ones less so.",
 ['moshoeshoe', 'moshesh', 'lesotho', 'basotho', 'thaba bosiu'],
 [
  stop('c. 1786', 'Born at Menkhoaneng', 'near present-day Hlotse, Lesotho', -28.87336111, 28.04158333, 20000,
   "Lepoqo, later called Moshoeshoe, was born the son of a minor Koena chief. The name Moshoeshoe, \"the shaver\", came from a daring cattle raid in his youth.",
   A, 'His birth year is estimated; the marker shows Hlotse, near Menkhoaneng.', [THOMPSON]),
  stop('c. 1820', 'Butha-Buthe', 'Butha-Buthe, Lesotho', -28.78333333, 28.23333333, 10000,
   "Moshoeshoe set up his first stronghold on the mountain at Butha-Buthe. Raids during the wars of the early 1820s showed him it could not be held.",
   A, 'Dates for these years come from oral tradition.', [THOMPSON]),
  stop('1824', 'Thaba Bosiu', 'Thaba Bosiu, Lesotho', -29.3503, 27.6713, 6000,
   "He led his people on a winter march to this flat-topped mountain, the \"mountain at night\". It was never taken by force, and refugees of many origins gathered under his protection.",
   E, '', [THOMPSON, CASALIS]),
  stop('1833', 'Missionaries at Morija', 'Morija, Lesotho', -29.62972222, 27.51333333, 5000,
   "Moshoeshoe invited French Protestant missionaries to settle here. They brought writing, advice in dealing with Europeans, and a written record of his reign.",
   E, '', [THOMPSON, CASALIS]),
  stop('20 December 1852', 'Battle of Berea', 'Berea Plateau, Lesotho', -29.32, 27.6, 15000,
   "A British force came to seize cattle and was fought to a standstill. That night Moshoeshoe sent a famously tactful letter offering peace, and the British withdrew.",
   E, '', [THOMPSON]),
  stop('1865', 'Thaba Bosiu holds', 'Thaba Bosiu, Lesotho', -29.3503, 27.6713, 6000,
   "In the wars with the Orange Free State over farmland, Free State forces besieged the mountain. Their commander was killed in an assault and the siege failed.",
   E, '', [THOMPSON]),
  stop('1869', 'Treaty of Aliwal North', 'Aliwal North, Eastern Cape', -30.7, 26.7, 15000,
   "Moshoeshoe had asked for British protection, and Basutoland was annexed in 1868. This treaty fixed borders that left much of the western lowlands in the Free State.",
   E, '', [THOMPSON]),
  stop('11 March 1870', 'Dies at Thaba Bosiu', 'Thaba Bosiu, Lesotho', -29.3503, 27.6713, 6000,
   "Moshoeshoe died on his mountain, where he is buried. The kingdom he built survived to become independent Lesotho in 1966.",
   E, '', [THOMPSON]),
 ])

# ======================================================================
tour('mzilikazi', "Mzilikazi's migration", 'c. 1822 to 1868, from Zululand to Zimbabwe',
 "Mzilikazi broke with Shaka and led his followers more than a thousand kilometres north, building the Ndebele kingdom on the move. It ended in present-day Zimbabwe, around Bulawayo.",
 "The record draws on Ndebele oral tradition and the journals of missionaries and travellers who met Mzilikazi. Many of his early settlements are known only approximately.",
 ['mzilikazi', 'ndebele', 'matabele'],
 [
  stop('c. 1822', 'Breaks with Shaka', 'Khumalo country, near present-day Mkuze', -27.61666667, 32.03333333, 30000,
   "Mzilikazi, a Khumalo chief serving Shaka, kept cattle from a raid instead of handing them over. Expecting punishment, he fled north with a few hundred followers.",
   A, 'The year and the starting point are approximate.', [RASMUSSEN]),
  stop('c. 1823', 'On the Steelpoort', 'near present-day Steelpoort, Limpopo', -24.73, 30.2, 40000,
   "His followers settled for a few years in the east of the Highveld, raiding and absorbing local communities. The kingdom grew as captives and refugees joined.",
   A, 'The marker shows the general area of these early settlements.', [RASMUSSEN]),
  stop('c. 1827', 'Settles near the Magaliesberg', 'west of present-day Pretoria', -25.74416667, 27.89944444, 40000,
   "The Ndebele moved west and built towns in the Magaliesberg area. In 1829 the missionary Robert Moffat visited, beginning a long friendship with Mzilikazi.",
   A, 'The marker shows Hartbeespoort; his towns lay across this region.', [RASMUSSEN, MOFFAT]),
  stop('1832', 'Moves to Mosega', 'near present-day Zeerust, North West', -25.53333333, 26.08333333, 25000,
   "Pressed by raids from Zulu and Griqua forces, Mzilikazi moved further west to the Marico valley, with Mosega as a main centre.",
   A, 'The marker shows Zeerust; Mosega lies nearby.', [RASMUSSEN]),
  stop('October 1836', 'Battle of Vegkop', 'near present-day Heilbron, Free State', -27.4775, 27.91388889, 8000,
   "Ndebele regiments attacked a Voortrekker wagon laager here and were driven off by gunfire, though they took most of the trekkers' cattle.",
   E, '', [RASMUSSEN]),
  stop('1837', 'Driven from Mosega', 'near present-day Zeerust, North West', -25.53333333, 26.08333333, 25000,
   "Voortrekker and Griqua forces attacked Mosega in January and again later in the year. Mzilikazi decided to leave the Highveld and lead his people north across the Limpopo.",
   A, 'Locations are approximate.', [RASMUSSEN]),
  stop('c. 1840', 'A new kingdom', 'around present-day Bulawayo, Zimbabwe', -20.17, 28.58, 40000,
   "After the migration split and rejoined, the Ndebele settled on the highlands of south-western Zimbabwe, conquering and absorbing Shona and other communities there.",
   A, 'His capitals moved over time; the marker shows Bulawayo.', [RASMUSSEN]),
  stop('September 1868', 'Buried in the Matobo Hills', 'Matobo Hills, Zimbabwe', -20.55, 28.508, 25000,
   "Mzilikazi died after nearly 50 years as king and was buried in a cave at Entumbane in the Matobo Hills. His son Lobengula succeeded him.",
   A, 'The marker shows the Matobo hills; the grave site lies within them.', [RASMUSSEN]),
 ])

# ======================================================================
tour('anglo-zulu-war', 'The Anglo-Zulu War', '1878 to 1879, Zululand',
 "Britain invaded the Zulu kingdom to bring it into a planned confederation of South Africa. Despite a stunning Zulu victory at Isandlwana, the kingdom was defeated within seven months.",
 "Unusually well documented: British military reports, soldiers' letters and later Zulu testimony collected by historians. Casualty figures for the Zulu side are estimates.",
 ['anglo-zulu', 'isandlwana', 'rorke', 'cetshwayo', 'ulundi', 'zulu war'],
 [
  stop('11 December 1878', 'The ultimatum', 'Lower Thukela, beside Fort Pearson', -29.21372222, 31.43302778, 3000,
   "Under a fig tree on the Thukela River, British officials read terms to King Cetshwayo's envoys that he could not accept, including disbanding his army.",
   E, '', [GUY, LABAND_KIC]),
  stop('22 January 1879', 'Isandlwana', 'Isandlwana, KwaZulu-Natal', -28.35638889, 30.6525, 5000,
   "The main Zulu army surprised a British camp beneath this sphinx-shaped hill. More than 1,300 men on the British side were killed, the worst defeat of a British army by an African force.",
   E, '', [LABAND_KIC, KNIGHT]),
  stop('22 to 23 January 1879', "Rorke's Drift", "Rorke's Drift, KwaZulu-Natal", -28.35805556, 30.53666667, 2500,
   "The invasion had crossed the Buffalo River here. Hours after Isandlwana, about 150 soldiers held the mission station through the night against several thousand Zulu reserves.",
   E, '', [KNIGHT]),
  stop('28 March 1879', 'Hlobane', 'Hlobane mountain, KwaZulu-Natal', -27.69888889, 30.95, 8000,
   "A British raid on this flat-topped mountain was caught by the arrival of the main Zulu army and routed.",
   E, '', [LABAND_KIC]),
  stop('29 March 1879', 'Kambula', 'Kambula, KwaZulu-Natal', -27.69289391, 30.6727024, 4000,
   "The next day, the same Zulu army attacked a fortified British camp and was beaten off with heavy losses. Many historians see this as the turning point.",
   E, '', [LABAND_KIC, KNIGHT]),
  stop('2 April 1879', 'Gingindlovu', 'Gingindlovu, KwaZulu-Natal', -29.0117, 31.579118, 5000,
   "A relief column defeated a Zulu force here and went on to lift the siege of a British garrison at Eshowe.",
   E, '', [LABAND_KIC]),
  stop('4 July 1879', 'Ulundi', 'Ulundi, KwaZulu-Natal', -28.31111111, 31.42638889, 5000,
   "A British square of infantry, artillery and Gatling guns broke the last major Zulu attack. Cetshwayo's royal homestead at oNdini was burned.",
   E, '', [LABAND_KIC, GUY]),
  stop('28 August 1879', "Cetshwayo's capture", 'Ngome Forest, KwaZulu-Natal', -27.83333333, 31.41666667, 15000,
   "The king was captured in the Ngome forest and sent into exile. Britain divided the kingdom into 13 chiefdoms, setting off years of civil war.",
   A, 'The exact capture site within the forest area is approximate.', [GUY]),
 ])

# ======================================================================
tour('diamonds-and-gold', 'Diamonds and gold', '1867 to 1896, South Africa',
 "Within twenty years, diamonds at Kimberley and gold on the Witwatersrand turned a farming region into an industrial economy. Mining built Johannesburg, the migrant labour system and the fortunes behind the next war.",
 "Well documented in company records, colonial reports and newspapers. The experiences of Black miners are recorded less fully than those of owners and officials.",
 ['big hole', 'witwatersrand', 'kimberley diamond', 'south african gold', 'diamonds and gold'],
 [
  stop('1867', 'The Eureka diamond', 'near Hopetown, Northern Cape', -29.62583333, 24.08555556, 12000,
   "A boy named Erasmus Jacobs picked up a shiny pebble on his family's farm near the Orange River. It turned out to be a 21-carat diamond.",
   E, '', [MEREDITH]),
  stop('1871', 'The Big Hole', 'Kimberley, Northern Cape', -28.73888889, 24.75888889, 2500,
   "Diamonds were found on a small hill, and thousands of diggers turned it into a pit. By 1888 Cecil Rhodes had merged the claims into De Beers, and Black workers were housed in closed compounds.",
   E, '', [MEREDITH, TURRELL]),
  stop('1873', "Pilgrim's Rest", "Pilgrim's Rest, Mpumalanga", -24.90777778, 30.75666667, 5000,
   "Alluvial gold in this valley drew diggers to the eastern escarpment. The village is preserved much as the mining camp left it.",
   E, '', [MEREDITH]),
  stop('1884', 'Barberton', 'Barberton, Mpumalanga', -25.78611111, 31.05305556, 6000,
   "A gold boom here created the region's first stock exchange. It faded fast, but it trained the prospectors who went to the Witwatersrand.",
   E, '', [MEREDITH]),
  stop('1886', 'The Main Reef', 'Langlaagte, west of central Johannesburg', -26.20444444, 28.04555556, 12000,
   "Prospectors found the outcrop of the Main Reef on the farm Langlaagte. Johannesburg was laid out months later and grew into South Africa's largest city.",
   A, 'The marker shows central Johannesburg; Langlaagte lies a few kilometres west.', [MEREDITH, VANONSELEN]),
  stop('2 January 1896', 'The Jameson Raid ends', 'Doornkop, west of Johannesburg', -26.23277778, 27.78333333, 6000,
   "A force backed by Rhodes tried to spark an uprising of foreign miners against the Transvaal government and surrendered here. Rhodes resigned, and trust between Briton and Boer collapsed.",
   E, '', [MEREDITH, PAKENHAM]),
 ])

# ======================================================================
tour('south-african-war', 'The South African War', '1899 to 1902, South Africa',
 "Britain fought the two Boer republics for control of the Transvaal and its gold. The war began with sieges and set-piece battles and ended with farm burning and concentration camps.",
 "The British and Boer sides are well documented. The Black experience, as soldiers, scouts, labourers and camp inmates, was long left out and is still being recovered; camp death tolls for Black people are estimates.",
 ['boer war', 'anglo-boer', 'south african war', 'mafeking', 'spion kop', 'spioenkop'],
 [
  stop('13 October 1899', 'Siege of Mafeking', 'Mafikeng, North West', -25.86555556, 25.64361111, 6000,
   "Two days after war was declared, Boer forces surrounded this railway town. Robert Baden-Powell's garrison held out for 217 days, with Black residents doing much of the fighting and suffering most of the hunger.",
   E, '', [PAKENHAM, NASSON]),
  stop('14 October 1899', 'Siege of Kimberley', 'Kimberley, Northern Cape', -28.73833333, 24.76388889, 6000,
   "The diamond town, with Cecil Rhodes inside, was besieged for four months.",
   E, '', [PAKENHAM]),
  stop('2 November 1899', 'Siege of Ladysmith', 'Ladysmith, KwaZulu-Natal', -28.5592, 29.7808, 7000,
   "A British army was trapped here for 118 days. Relieving it took months of costly fighting.",
   E, '', [PAKENHAM]),
  stop('11 December 1899', 'Magersfontein', 'Magersfontein, Northern Cape', -28.96944444, 24.69833333, 6000,
   "Boers dug trenches at the foot of the hills instead of on top, and the Highland Brigade walked into their fire at dawn. It was one of three British defeats in \"Black Week\".",
   E, '', [PAKENHAM, NASSON]),
  stop('24 January 1900', 'Spion Kop', 'Spioenkop, KwaZulu-Natal', -28.65, 29.51638889, 5000,
   "British troops took the summit at night and found at dawn that they were exposed to fire from three sides. Hundreds died in shallow trenches before both sides withdrew.",
   E, '', [PAKENHAM]),
  stop('27 February 1900', 'Paardeberg', 'Paardeberg, Free State', -28.99083333, 25.07527778, 7000,
   "General Cronje's army was surrounded on the Modder River and surrendered after a ten-day siege, the turning point of the conventional war.",
   E, '', [PAKENHAM, NASSON]),
  stop('5 June 1900', 'Pretoria taken', 'Church Square, Pretoria', -25.7465, 28.1882, 2000,
   "British forces entered the Transvaal capital. The war was expected to end; instead the Boers turned to guerrilla warfare for two more years.",
   E, '', [PAKENHAM]),
  stop('1900 to 1902', 'The camps', 'Bloemfontein, Free State', -29.1416, 26.2083, 4000,
   "To defeat the guerrillas, Britain burned farms and moved civilians into camps. About 28,000 Boer civilians died, most of them children, along with at least 14,000 Black people in separate camps. The National Women's Monument stands here.",
   D, 'The Boer death toll is well established; the number of Black deaths is an estimate and probably too low.', [VANHEYNINGEN, KESSLER]),
  stop('31 May 1902', 'Peace signed', 'Melrose House, Pretoria', -25.7555, 28.1925, 1500,
   "After talks at Vereeniging, the Treaty of Vereeniging was signed in this house. The republics became British colonies, and the question of Black political rights was postponed.",
   E, '', [PAKENHAM, NASSON]),
 ])

# ======================================================================
tour('june-16', 'June 16, 1976', 'June to August 1976, Soweto and beyond',
 "Students marched against being taught in Afrikaans and were met with police gunfire. The uprising spread across the country and brought a new generation into the struggle.",
 "Well documented in photographs, press reports and later testimony, including to the Truth and Reconciliation Commission. The number of people killed is disputed.",
 ['june 16', 'soweto uprising', 'soweto 1976', 'hector pieterson'],
 [
  stop('16 June 1976, morning', 'Naledi High School', 'Naledi, Soweto', -26.25048, 27.831368, 1500,
   "Students here had already been organising against a 1974 order that half of all subjects be taught in Afrikaans. On the morning of the 16th, they set out to join students from other schools.",
   E, '', [NDLOVU, BROOKS]),
  stop('16 June 1976, morning', 'Morris Isaacson High School', 'Jabavu, Soweto', -26.2455, 27.8722, 1500,
   "Student leader Tsietsi Mashinini addressed pupils here before the march. Columns from different schools converged and headed for Orlando Stadium.",
   E, '', [NDLOVU, BROOKS]),
  stop('16 June 1976', 'Orlando West', 'Orlando West, Soweto', -26.23483333, 27.90861667, 1200,
   "Near Orlando West High School, police opened fire on the marchers. Sam Nzima photographed 12-year-old Hector Pieterson being carried by Mbuyisa Makhubo; the image went around the world. The Hector Pieterson Museum stands here.",
   E, '', [NDLOVU, POHLANDT]),
  stop('16 June 1976', 'Orlando Stadium', 'Orlando, Soweto', -26.23189444, 27.92289167, 1500,
   "The stadium was the planned destination of the march. Students never reached it as the day turned into running battles with police across Soweto.",
   E, '', [BROOKS]),
  stop('17 to 18 June 1976', 'Alexandra', 'Alexandra, Johannesburg', -26.10383333, 28.09616667, 4000,
   "Within days, the protests spread to other townships around Johannesburg, including Alexandra, and then to the rest of the country.",
   E, '', [BROOKS]),
  stop('August 1976', 'Langa', 'Langa, Cape Town', -33.94527778, 18.53, 4000,
   "Students in Cape Town's townships rose up in August, and protests continued into 1977. The official death toll was 176; other estimates run to several hundred.",
   D, 'The death toll is disputed: official figures were lower than independent estimates.', [BROOKS, TRC]),
 ])

# ======================================================================
tour('steve-biko', 'Steve Biko', '1946 to 1977, South Africa',
 "Steve Biko led the Black Consciousness Movement, which told Black South Africans to reject inferiority and organise for themselves. He died in police custody at 30.",
 "His own writings, a biography by a close friend, inquest records and the Truth and Reconciliation Commission document his life and death in detail. Several towns on this route have since been renamed.",
 ['biko', 'black consciousness', 'saso'],
 [
  stop('18 December 1946', 'Born in Tarkastad', 'Tarkastad, Eastern Cape', -32.0075, 26.26, 6000,
   "Bantu Stephen Biko was born here and raised in Ginsberg township, outside King William's Town, by his mother after his father's early death.",
   E, '', [MANGCU, WOODS]),
  stop('1963', 'Expelled from Lovedale', 'Alice, Eastern Cape', -32.78916667, 26.835, 4000,
   "At Lovedale College, Biko was questioned by police after his brother's arrest and expelled. He later said it was the start of his hostility to authority.",
   E, '', [MANGCU, WOODS]),
  stop('1964 to 1965', 'St Francis College', 'Mariannhill, near Durban', -29.85, 30.83333333, 4000,
   "He finished school at this Catholic boarding school, where he read widely and debated liberalism and politics.",
   E, '', [MANGCU]),
  stop('1966', 'Medical school in Durban', 'Wentworth, Durban', -29.91666667, 31.0, 4000,
   "Biko studied medicine in the \"non-European\" section of the University of Natal and lived in the student residence at Wentworth, where his politics took shape.",
   E, '', [MANGCU, WOODS]),
  stop('July 1969', 'SASO launched', 'Turfloop, present-day University of Limpopo', -23.886, 29.738, 5000,
   "Biko led Black students out of the white-led student union to found the South African Students' Organisation, launched at a conference here.",
   E, '', [BIKO, MANGCU]),
  stop('1973', 'Banned to King William\'s Town', 'Qonce, formerly King William\'s Town', -32.88333333, 27.4, 6000,
   "The government banned Biko and confined him to his home district. He kept working, setting up community projects including the Zanempilo clinic nearby.",
   E, '', [WOODS, MANGCU]),
  stop('18 August 1977', 'Arrested at a roadblock', 'near Makhanda, formerly Grahamstown', -33.31, 26.52666667, 12000,
   "Biko and Peter Jones were stopped at a police roadblock outside the town and taken into detention.",
   A, 'The marker shows Makhanda; the roadblock was outside the town.', [WOODS, TRC]),
  stop('September 1977', 'Detained in Port Elizabeth', 'Gqeberha, formerly Port Elizabeth', -33.95805556, 25.6, 8000,
   "Held naked and shackled in security police offices, Biko suffered a severe head injury during interrogation.",
   E, '', [WOODS, TRC]),
  stop('12 September 1977', 'Dies in Pretoria', 'Kgosi Mampuru II prison, Pretoria', -25.7612, 28.1816, 2000,
   "Police drove him more than 1,000 kilometres to Pretoria in the back of a vehicle, and he died in a prison cell. An inquest found no one responsible; in 1999 the Truth and Reconciliation Commission refused amnesty to the officers involved.",
   E, '', [WOODS, TRC]),
 ])

# ======================================================================
tour('human-origins', 'Human origins', 'about 3.7 million to 44,000 years ago, South Africa',
 "Some of the most important evidence for human evolution comes from South African caves, from early hominins to the first signs of symbolic thought.",
 "Dates here come from scientific dating methods with error ranges, and several are still argued over. Stops are in order of age, not of discovery.",
 ['human origins', 'cradle of humankind', 'sterkfontein', 'taung', 'blombos'],
 [
  stop('c. 3.67 million years ago', 'Little Foot', 'Sterkfontein Caves, Gauteng', -26.0157, 27.7346, 2500,
   "An almost complete Australopithecus skeleton, nicknamed Little Foot, took about 20 years to excavate from the cave rock. The same caves gave up the skull known as Mrs Ples in 1947.",
   D, 'Its age is disputed: one dating method gives 3.67 million years, others suggest closer to 2.6 million.', ['Granger et al., Nature (2015)']),
  stop('c. 2.8 million years ago', 'The Taung Child', 'near Taung, North West', -27.5625, 24.74805556, 12000,
   "A child's skull found at a limestone quarry here in 1924 was named Australopithecus africanus by Raymond Dart. Most scientists doubted him for decades; he was right that Africa was central to human origins.",
   A, 'The age is approximate; the marker shows Taung, near the quarry.', ['Raymond Dart, Nature (1925)']),
  stop('c. 1 million years ago', 'Wonderwerk Cave', 'near Kuruman, Northern Cape', -27.845, 23.55388889, 3000,
   "Burnt bone and plant ash deep inside this cave are among the earliest evidence of controlled fire anywhere.",
   A, 'The age and how deliberate the fire was are still studied.', ['Berna et al., PNAS (2012)']),
  stop('c. 300,000 years ago', 'Homo naledi', 'Rising Star cave, Cradle of Humankind', -25.934, 27.783, 4000,
   "Cavers found more than 1,500 bones of a small-brained human relative deep in a hard-to-reach chamber. Why so many bodies ended up there is hotly debated.",
   D, 'Its age range is well dated; claims that it buried its dead are disputed. The marker is placed approximately.', ['Dirks et al., eLife (2017)']),
  stop('c. 164,000 years ago', 'Pinnacle Point', 'Pinnacle Point, Mossel Bay', -34.20777778, 22.08944444, 3000,
   "People sheltering in these sea caves ate shellfish and ground red ochre, among the earliest such evidence in the world.",
   E, '', ['Marean et al., Nature (2007)']),
  stop('c. 110,000 years ago', 'Klasies River Caves', 'Klasies River, Eastern Cape', -34.10810278, 24.39013889, 3000,
   "Remains here are among the oldest known of anatomically modern humans in southern Africa.",
   A, 'Dates vary between layers of the site.', ['Singer and Wymer, The Middle Stone Age at Klasies River Mouth in South Africa (1982)']),
  stop('c. 75,000 years ago', 'Blombos Cave', 'near Still Bay, Western Cape', -34.41444444, 21.2225, 3000,
   "Pieces of ochre engraved with crosshatched lines, along with shell beads, are among the earliest known signs of symbolic thinking.",
   E, '', ['Henshilwood et al., Science (2002)']),
  stop('c. 44,000 years ago', 'Border Cave', 'Lebombo Mountains, KwaZulu-Natal', -27.0249, 31.9889, 3000,
   "Tools here, including a poison applicator and digging-stick weights, look like those used by San people in recent times, suggesting very long cultural continuity.",
   A, 'Some researchers question how direct the link is to later San culture.', ["d'Errico et al., PNAS (2012)"]),
 ])

# ======================================================================
tour('mapungubwe', 'Mapungubwe', 'c. 900 to 1450, the Limpopo valley',
 "Mapungubwe was southern Africa's first known kingdom, a trading state whose rulers lived on a hilltop above the Limpopo. Its gold, ivory and glass beads connected it to the Indian Ocean world.",
 "Everything here comes from archaeology: there are no written records. Dates come from radiocarbon dating, and reasons for the rise and fall of these towns are interpretations.",
 ['mapungubwe', 'golden rhino', 'limpopo kingdom'],
 [
  stop('c. 900', 'Schroda', 'Limpopo valley, near Mapungubwe', -22.25, 29.2, 20000,
   "The first big town in the valley grew rich trading ivory toward the coast. Clay figurines found here suggest initiation ceremonies.",
   A, 'The marker shows the national park; Schroda lies nearby.', [HUFFMAN]),
  stop('c. 1000', 'K2', 'below Mapungubwe Hill', -22.1925, 29.23888889, 4000,
   "The capital moved to a settlement now called K2, at the foot of the hill. Trade in glass beads and gold grew, and so did differences in wealth.",
   A, 'The marker shows the hill; K2 lies just beside it.', [HUFFMAN]),
  stop('c. 1220', 'Mapungubwe Hill', 'Mapungubwe National Park, Limpopo', -22.1925, 29.23888889, 2500,
   "The ruler and elite moved to the top of the hill, separating themselves from commoners below. Archaeologists see this as the beginning of a class-based kingdom.",
   E, '', [HUFFMAN, PIKIRAYI]),
  stop('c. 1250', 'Thulamela', 'Kruger National Park, Limpopo', -22.43333333, 31.1975, 4000,
   "A later stone-walled hilltop town to the east shows the Mapungubwe tradition spreading. Gold and trade goods were found in its royal graves.",
   A, 'Thulamela was occupied for centuries; this date is its earliest phase.', [PIKIRAYI]),
  stop('c. 1300', 'Great Zimbabwe', 'near present-day Masvingo, Zimbabwe', -20.26666667, 30.93333333, 4000,
   "As Mapungubwe was abandoned, power shifted north to Great Zimbabwe, whose builders raised the largest ancient stone structures in Africa south of the Sahara.",
   A, 'Why Mapungubwe declined, perhaps a drier climate or shifting trade routes, is debated.', [PIKIRAYI, HUFFMAN]),
  stop('1933', 'The golden rhinoceros', 'University of Pretoria', -25.75361111, 28.22972222, 1500,
   "Royal graves on the hilltop were excavated, revealing a small rhinoceros of gold foil over a wooden core. It is kept, with the rest of the Mapungubwe Collection, at the University of Pretoria.",
   E, '', [HUFFMAN]),
 ])

# ======================================================================
tour('dias', 'Dias round the Cape', '1487 to 1488, Lisbon to the Eastern Cape',
 "Bartolomeu Dias led the first European ships known to sail round the southern tip of Africa, opening a sea route to the Indian Ocean.",
 "Dias's own report is lost; the voyage is known mainly from later Portuguese chronicles and from stone crosses he raised, one of which was found in pieces in 1938. Khoikhoi people had lived on these shores for centuries.",
 ['bartolomeu', 'dias round', 'dias voyage'],
 [
  stop('August 1487', 'Leaves Lisbon', 'Lisbon, Portugal', 38.72527778, -9.15, 20000,
   "Dias sailed with two caravels and a supply ship, ordered to find the end of Africa and a sea route east.",
   E, '', [AXELSON, BARROS]),
  stop('December 1487', 'Angra Pequena', 'Luderitz, Namibia', -26.64583333, 15.15388889, 15000,
   "The fleet anchored in this bay on the desert coast. On the way home, Dias is said to have raised a stone cross on the nearby headland now called Dias Point.",
   A, 'Chronicle dates differ; the cross site is shown approximately.', [AXELSON]),
  stop('3 February 1488', 'Mossel Bay', 'Mossel Bay, Western Cape', -34.18333333, 22.13333333, 8000,
   "After a storm blew the ships far south, Dias turned north and reached land here, past the Cape without seeing it. Khoikhoi herders drove the strangers off and one was killed by a Portuguese crossbow.",
   E, '', [AXELSON, BARROS]),
  stop('March 1488', 'The cross at Kwaaihoek', 'Kwaaihoek, Eastern Cape', -33.718499, 26.624014, 3000,
   "Dias raised a stone cross, a padrao, on this headland. Its fragments were found and pieced together in 1938, and a replica stands here.",
   E, '', [AXELSON]),
  stop('March 1488', 'Turning back', 'Great Fish River mouth, Eastern Cape', -33.49277778, 27.13111111, 15000,
   "With the coast clearly turning north-east toward India, the exhausted crew forced Dias to turn back near this river.",
   A, 'The exact turning point is uncertain.', [AXELSON, BARROS]),
  stop('May 1488', 'Cape of Good Hope', 'Cape of Good Hope, Western Cape', -34.35805556, 18.47555556, 6000,
   "On the way home Dias finally saw the cape. By tradition he named it the Cape of Storms, and King John II renamed it the Cape of Good Hope.",
   D, 'The naming story comes from later chroniclers and may be legend.', [BARROS]),
 ])

# ======================================================================
tour('krotoa', 'Krotoa and the early Cape', '1652 to 1674, Table Bay',
 "Krotoa, a young Khoi woman, became the chief interpreter between the Dutch settlement at the Cape and the Khoikhoi. Her life traces the first two decades of colonial South Africa.",
 "She is known almost entirely through the official journal of the Dutch settlement, written by men who saw her as useful and later as a disgrace. Her own voice survives only as they reported it.",
 ['krotoa', 'early cape'],
 [
  stop('1652', 'The Dutch fort', 'Table Bay, present-day Cape Town', -33.9259, 18.4278, 2500,
   "The Dutch East India Company built a fort here to supply its ships. Krotoa, about ten years old and a niece of the Khoi leader Autshumao, was taken into the household of the commander, Jan van Riebeeck.",
   A, 'Her age is an estimate; the original fort stood near the later Castle.', [VRJ, WELLS]),
  stop('c. 1657 to 1660', 'Among the Cochoqua', 'near Saldanha Bay, Western Cape', -33.03472222, 18.00972222, 25000,
   "Krotoa's sister was married to the Cochoqua leader Oedasoa, and Krotoa carried messages and negotiated cattle trade between his people and the Dutch.",
   A, 'The Cochoqua moved with their herds; the marker shows the general area.', [WELLS, ELPHICK]),
  stop('1659', 'War on the Liesbeek', 'Liesbeek River, Cape Town', -33.93638889, 18.47638889, 4000,
   "Khoikhoi fought the first war against the settlers as Dutch farms spread along the river onto their grazing land. Krotoa interpreted the peace talks.",
   E, '', [ELPHICK, VRJ]),
  stop('1660', "Van Riebeeck's hedge", 'Kirstenbosch, Cape Town', -33.9875, 18.4325, 2000,
   "A hedge of wild almond was planted to mark the colony's boundary and keep the Khoikhoi out. A stretch of it still grows in Kirstenbosch.",
   E, '', [ELPHICK]),
  stop('1664', 'Married at the fort', 'Table Bay, present-day Cape Town', -33.9259, 18.4278, 2500,
   "Baptised as Eva in 1662, Krotoa married the Danish surgeon Pieter van Meerhof, the first recorded marriage between a Khoi woman and a European at the Cape.",
   E, '', [VRJ, WELLS]),
  stop('1665 to 1669', 'Robben Island', 'Robben Island, Table Bay', -33.805, 18.37, 6000,
   "She moved to the island when van Meerhof became its superintendent. After he was killed on an expedition to Madagascar, she struggled, and in 1669 she was banished back to the island, away from her children.",
   E, '', [WELLS]),
  stop('1674', 'Buried in the Castle', 'Castle of Good Hope, Cape Town', -33.9259, 18.4278, 1500,
   "Krotoa died at about 32 and was buried inside the newly built Castle. Today many South Africans claim descent from her, and she has become a symbol of a mixed and painful origin.",
   E, '', [WELLS]),
 ])

os.makedirs(OUT, exist_ok=True)
index = []
for t in TOURS:
    with open(os.path.join(OUT, t['id'] + '.json'), 'w') as f:
        json.dump(t, f, ensure_ascii=True, indent=1)
    index.append(dict(id=t['id'], title=t['title'], span=t['span'], keywords=t['keywords'], stops=len(t['stops'])))
with open(os.path.join(OUT, 'index.json'), 'w') as f:
    json.dump(index, f, ensure_ascii=True, indent=1)
print(len(TOURS), 'tours,', sum(len(t['stops']) for t in TOURS), 'stops')
