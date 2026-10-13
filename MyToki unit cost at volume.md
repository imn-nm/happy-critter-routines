# MyToki unit cost at volume

Oct 9, 2026 · @Imaan Naeem

## Summary

One MyToki with its dock costs about $40 to make and ship to a US warehouse at 10,000 a year, $29 at 50,000 and $26 at 100,000, if US customs treats it as a toy. If it is taxed as a Wi-Fi device instead, add about $7 at 10,000 and $5 at 100,000. At 1,000 a year the molds and certification alone come to $60 a unit, so a first run of 1,000 is a pilot you pay for, not a product.

The $30 target from the market study is reachable at about 50,000 a year with the current 1.75-inch AMOLED design, if customs treats MyToki as a toy. At 10,000 the swaps in the last section (a 1.6-inch LCD, simpler audio, a plainer dock and box) only get it to about $33; the rest comes from volume.

Three things move the number more than anything else:

- **Volume**, which halves the one-off costs per unit between 10,000 and 50,000 and takes a dollar or two off the screen and the module.
- **Customs classification.** A toy pays 12.5% duty today; electronics pay 37.5%. That is about $7 a unit at 10,000, for the price of a customs ruling.
- **The screen.** The AMOLED is $8 of the $26.50 of parts at 10,000. A 1.6-inch round LCD is about $4.50, at the cost of redoing the Field Kit screens for a smaller, dimmer display.

Every number here is an estimate built from supplier listings and rules of thumb, not quotes. The parts marked as estimates in the table below are the ones to quote first.

## What is in the box, and what each part costs

The screen is the biggest line at every volume and the Wi-Fi module is second; everything else is small parts that fall quickly with volume. Prices are US dollars per unit for parts and labour in China, before the factory's margin, shipping and duties. Rows marked "estimate" have no quote behind them yet.

| Part | 1,000 | 10,000 | 50,000 | 100,000 | Where the number comes from |
| --- | --- | --- | --- | --- | --- |
| Round AMOLED screen, 1.75 in, 466 × 466, with touch (the one the firmware runs on) | $9.50 | $8.00 | $7.40 | $7.00 | [$8.70 at 1,000 minimum](https://www.displayamoled.com/sale-53521450-1-75-inch-circular-amoled-display-466x466-dots-mipi-qspi-interface-driving-ic-cst9217-700c-d.html); the 1.73 in twin on [Alibaba](https://www.alibaba.com/product-detail/1-73-Inch-Round-AMOLED-Display_1601683035691.html) is $8.45 falling to $7.80 at 10,000; touch versions at sample quantities run $11 to $15 |
| ESP32-S3 module, 16 MB flash, 8 MB PSRAM, Wi-Fi and Bluetooth, already FCC-certified | $4.47 | $3.60 | $3.00 | $2.80 | [DigiKey, $4.47 on a reel of 650](https://www.digikey.com/en/products/detail/espressif-systems/ESP32-S3-WROOM-1-N16R8/16162642); the higher volumes are an estimate, since Espressif sells direct below distributor prices |
| Battery, 1,000 mAh lithium polymer with its protection circuit | $1.80 | $1.20 | $1.05 | $0.95 | [Alibaba, Shenzhen Data Power](https://www.alibaba.com/product-detail/803040-3-7V-1000mAh-083040-rechargeable-60787700599.html): $1.80 up to 2,999, $1.30 at 5,000, $1.20 at 10,000 and up, protection board and wires included; cells without it go as low as $0.48 at 100,000 |
| Accelerometer, 3-axis: wakes the screen when picked up, lets Biscuit react to a shake or a tap, knows when it is in the dock | $1.00 | $0.90 | $0.70 | $0.55 | ST LIS2DH12 at DigiKey: $1.01 each at 1,000 on cut tape, $0.91 on a reel of 8,000. The 50,000 and 100,000 figures assume a Chinese equivalent such as the SC7A20 |
| Speaker and audio chip | $1.20 | $0.90 | $0.75 | $0.70 | Estimate |
| Power and small parts: charger chip, regulator, fuel gauge, USB-C, charging contacts, the button, passives | $2.20 | $1.70 | $1.40 | $1.30 | Estimate |
| Circuit board, small, four layers | $1.20 | $0.70 | $0.50 | $0.45 | Estimate |
| Placing the parts on the board and testing it | $2.50 | $1.60 | $1.20 | $1.00 | Estimate; setup charges fade at volume and the parts dominate |
| Housing: three molded shells, a soft button cap, a lanyard loop, screws and adhesive | $3.00 | $2.00 | $1.50 | $1.30 | Estimate |
| Final assembly, loading the firmware, testing, packing | $2.50 | $1.80 | $1.40 | $1.20 | Estimate |
| **Handheld** | **$29.37** | **$22.40** | **$18.90** | **$17.25** |  |
| Dock: two molded parts, a small board with USB-C in, charging pins and magnets, night-light LEDs, assembly | $4.20 | $2.80 | $2.20 | $1.90 | Estimate. A branded 4-pin magnetic connector alone is [$5.18 at 1,000 from DigiKey](https://azcus.digikey.com/en/products/detail/attend-technology/303C-C4115-30-04/21284914); Chinese equivalents are under $1 |
| USB-C cable, 1 m, no wall plug | $0.70 | $0.50 | $0.40 | $0.35 | Estimate |
| Printed box, insert, quick-start card | $1.50 | $0.80 | $0.55 | $0.50 | Estimate; a printed folding carton is roughly $0.20 to $1.00 each at 5,000 |
| **Parts and build, in China** | **$35.77** | **$26.50** | **$22.05** | **$20.00** |  |

The table keeps the 1.75-inch AMOLED because that is what the firmware and the Field Kit screens are built on. The section on getting under $30 prices the swaps.

## Cost per unit by volume

&#91;embedded content: built from the parts table and the one-off costs in this doc · 4 volumes, 7 cost groups\]

At 1,000 a year the molds and certification are more than everything else put together. They are gone by 50,000. From 10,000 up, the two lines worth fighting are the screen and the duty; the rest only shrinks with volume.

## Costs that are not parts

Beyond the parts, five things add to each unit: the factory's margin, the molds and certification spread over the run, freight, US duty, and returns. Duty is the one that can swing by $7 a unit on a decision we have not made yet.

**Paid once, then spread over the run**

| One-off | Planning figure | What it covers |
| --- | --- | --- |
| Molds | $40,000 | Five or six steel tools: handheld front, back, button cap and lens ring; dock top and bottom. $5,000 to $10,000 each in China is the usual range for small cosmetic parts; the market deck planned $25,000 to $60,000. No quote yet. |
| FCC, and ISED for Canada | $8,000 | The Wi-Fi module is already certified, so only the finished product's own emissions need testing, about [half the cost of transmitter testing](https://www.digikey.com/en/ptm/l/linx-technologies-inc/understanding-rf-modules/tutorial?slide=13). Antenna placement and power-rail noise are the usual reasons a product fails and pays twice. |
| Children's product safety | $6,000 | A product for children 12 and under needs a CPSC-accepted lab: lead and phthalates, ASTM F963 mechanical tests, and [16 CFR 1505 for an electrically operated toy](https://cpsc.gov/FAQ/Toy-Safety). About a dozen units are destroyed per round. |
| Battery | $4,000 | UN38.3 for shipping and IEC 62133 for safety on the pack. Much of it carries over from the cell maker's own reports, so buy a cell that already has them. |
| CE and UKCA | Later | Only when selling in Europe or the UK; budget about as much again as FCC plus safety. |
| **Total spread over the run** | **about $60,000** | $60 a unit at 1,000; $6 at 10,000; $1.20 at 50,000; $0.60 at 100,000 |

**Added to every unit**

| Extra | How it is worked out | At 10,000 a year |
| --- | --- | --- |
| Factory margin | 8% on parts and build when the factory buys the parts for us | $2.12 |
| Freight, China to a US warehouse | Sea spot rates were [$2,000 to $3,100 per 40-foot container in October 2025](https://www.aol.com/finance/ocean-container-shipping-spot-rates-193005614.html), about $30 to $45 per cubic metre. A boxed MyToki and dock is about three litres, so the ocean leg is cents; port, drayage and broker fees make up the rest. Small lots go by air or shared container at several times that. | $0.80 ($2.50 at 1,000) |
| US duty if customs calls it a toy | 12.5%: the new Section 301 forced-labor duty on all Chinese goods since [24 July 2026](https://www.chrobinson.com/en-us/resources/insights-and-advisories/client-advisories/2026q3/07-24-26-client-advisory-new-section-301-forced-labor-tariffs-now-in-effect/), with China in the [12.5% tier](https://www.tariffstool.com/guides/tariff-on-electronics-from-china-2026). The 2019 toy tariff (List 4B) was never put in place. | $3.58 |
| US duty if customs calls it electronics | 37.5%: the 25% Section 301 List 3 duty that covers most Wi-Fi devices, plus the same 12.5% | $10.73 |
| Merchandise processing fee | 0.3464% of value | $0.10 |
| Returns and warranty | 3% of the ex-works cost | $0.86 |

The tariff rules changed four times in 2026: the IEEPA duties were struck down in February, a 10% surcharge ran from February to July, and the forced-labor duty replaced it. Treat the rates above as this month's and check them with a customs broker before pricing. The bigger question is classification: a handheld with Wi-Fi that runs a routine could be entered as a toy (heading 9503) or as a radio device (8517.62), and a binding ruling settles it before the first container.

**Not counted here**

- Engineering, which is $0 in cash: the hardware and software are developed in-house. The only development money is for prototype parts, such as dev boards, sample panels, printed shells and the dozen units a safety lab destroys, roughly $3,000 to $8,000 in total and not spread over the units.
- The parent app, the server and the Supabase bill.
- Warehousing and pick-and-pack for direct orders, usually $3 to $5 an order, and payment fees of about 3%.
- Finding the customer, which the market study puts at $40 to $80 a family.

## Getting under $30

At 10,000 a year the AMOLED MyToki is about $40. The screen, audio and carton swaps below bring it to about $35, and a bare dock on top to about $33; the rest of the way to $30 comes from volume. At 50,000 the first three swaps alone land it near $24. Savings include the margin and duty that ride on every part.

| Swap | Saves per unit at 10,000 | What it costs us |
| --- | --- | --- |
| Get a customs ruling that MyToki is a toy | $6.90 | A broker's fee and some paperwork. Not a design change, and the biggest single lever. |
| 1.6-inch round LCD, 400 × 400, with touch, instead of the 1.75-inch AMOLED | $4.40 | Round 1.6-inch panels list at [$2.50 to $5.95](https://m.alibaba.com/product/1600533610150/Small-Round-1-6-inch-400x400.html) without touch, falling to $3.95 at 100,000. Smaller and dimmer, with a backlight that draws power all day, so the battery may need to grow. Every Field Kit screen and the firmware's 466-pixel layout would be redone. |
| Simple amplifier instead of the audio codec | $0.50 | Chimes only, no speech on the board. Speech was never on the board yet. |
| Plain printed carton, no insert | $0.35 | Less of an unboxing. |
| Bare dock: a cradle with charging pins and one LED, no board of its own | $1.90 | Loses the night-light and ok-to-wake colours that are part of the pitch. Keep the LEDs and drop only the light sensor to save about half this. |
| ESP32-S3 with 8 MB flash instead of 16 MB | $0.40 | Biscuit's frames take about 450 KB and the 466 × 466 frame buffer needs the 8 MB PSRAM, so this is the smallest module that still fits. |
| 600 mAh battery instead of 1,000 mAh | $0.30 | Risks the full-day promise, which is the point of a carried device. Only with the AMOLED, whose dark screens draw little. |

Two swaps not worth making: a 1.28-inch 240 × 240 round LCD with touch is still [$6 to $7 at volume](https://www.alibaba.com/showroom/gc9a01-round-display.html) and far smaller, so it saves little; and a 2.1-inch 480 × 480 round LCD costs about what the AMOLED does.

A button-only MyToki with a $2 non-touch 1.28-inch screen would cost about $8 less than the AMOLED version, but the carousel, swipe-to-close and tap-Biscuit interactions would all have to go. That is a different product.

## Assumptions, and what still needs a real quote

**Assumed**

- Volumes are units a year, built in two or three runs, so each run is big enough for the factory's price breaks.
- Prices are ex-works China in US dollars, October 2026. The factory buys the parts and adds 8%.
- One handheld and one dock per box, with a USB-C cable and no wall plug.
- Sold in the US only. Canada adds ISED testing; Europe adds CE and a different duty picture.
- The $60,000 of molds and certification is paid once and spread over one year's volume. Spread it over two years and the 10,000 figure drops by $3.
- Nothing is counted for yield loss beyond the 3% returns line. A hard first run can add 2% to 5%.
- The ESP32-S3 module keeps its FCC modular grant, which is what keeps the radio testing cheap.
- No research and development cost is counted. The hardware and software are built in-house, so the per-unit figures carry only what is paid to someone else: parts, the factory, molds, labs, freight and duty.

**Quote first, in this order**

- [ ] The screen: ask two makers for the 1.75-inch AMOLED with touch at 10,000 and 50,000, and the same for a 1.6-inch round LCD with touch. This is a third of the parts cost.
- [ ] A customs broker's view on toy versus radio device, and the cost of a binding ruling.
- [ ] A contract manufacturer's turnkey quote at 10,000 for the board, housing and final assembly, with molds itemised.
- [ ] An ESP32-S3 price direct from Espressif or its China distributors at 10,000.
- [ ] Battery packs with UN38.3 and IEC 62133 reports in hand, at 10,000.
- [ ] A CPSC-accepted lab's itemised quote for an electrically operated toy with a lithium battery.
- [ ] The dock as its own line, since it may be worth tooling as a simpler cradle for the packs.

**Open questions**

- [ ] Is the device a toy to CBP? The answer is worth $7 a unit.
- [ ] AMOLED or LCD for the product version? The firmware and all 43 Figma screens assume 466 pixels.
- [ ] Decided 9 October: every MyToki ships with its own dock, alone or in two- and three-packs at $139 and $199.
- [ ] Build in China, or assemble the final unit elsewhere to change the duty picture?

## Sources

Pages opened for the prices and rates above, as of 9 October 2026. Everything not linked is an estimate.

- [1.75-inch round AMOLED, $8.70 at 1,000 minimum](https://www.displayamoled.com/sale-53521450-1-75-inch-circular-amoled-display-466x466-dots-mipi-qspi-interface-driving-ic-cst9217-700c-d.html), displayamoled.com
- [1.73-inch round AMOLED, CO5300, $8.45 to $7.80 by quantity](https://www.alibaba.com/product-detail/1-73-Inch-Round-AMOLED-Display_1601683035691.html), Alibaba
- [ESP32-S3-WROOM-1-N16R8, $4.47 on reel at 650](https://www.digikey.com/en/products/detail/espressif-systems/ESP32-S3-WROOM-1-N16R8/16162642), DigiKey
- [803040 1,000 mAh battery with protection board, $1.80 to $1.20 by quantity](https://www.alibaba.com/product-detail/803040-3-7V-1000mAh-083040-rechargeable-60787700599.html), Alibaba, Shenzhen Data Power
- [1.6-inch 400 × 400 round LCD, $5.95 to $3.95 by quantity](https://m.alibaba.com/product/1600533610150/Small-Round-1-6-inch-400x400.html), Alibaba
- [1.28-inch GC9A01 round LCD listings](https://www.alibaba.com/showroom/gc9a01-round-display.html), Alibaba
- [4-pin magnetic pogo connector, $5.18 at 1,020](https://azcus.digikey.com/en/products/detail/attend-technology/303C-C4115-30-04/21284914), DigiKey
- [Pre-certified radio modules and what still needs testing](https://www.digikey.com/en/ptm/l/linx-technologies-inc/understanding-rf-modules/tutorial?slide=13), DigiKey
- [Toy safety rules, including electrically operated toys](https://cpsc.gov/FAQ/Toy-Safety), CPSC
- [Which ASTM F963 sections need a third-party lab](https://cpsc.gov/Business--Manufacturing/Business-Education/Toy-Safety/ASTM-F-963-Chart), CPSC
- [Section 301 forced-labor tariffs in effect 24 July 2026](https://www.chrobinson.com/en-us/resources/insights-and-advisories/client-advisories/2026q3/07-24-26-client-advisory-new-section-301-forced-labor-tariffs-now-in-effect/), C.H. Robinson
- [China electronics duty, 25% plus 12.5%](https://www.tariffstool.com/guides/tariff-on-electronics-from-china-2026), TariffsTool, updated 14 September 2026
- [US tariffs on China, lists and the suspended List 4B](https://hsrates.com/en/guides/us-tariffs-on-china-2026/), HSRates, as of 21 February 2026
- [Trans-Pacific container spot rates, October 2025](https://www.aol.com/finance/ocean-container-shipping-spot-rates-193005614.html), AOL Finance
- [MyToki Market Study](https://claude.ai/code/artifact/25be0a9a-372d-4acf-81f9-fefabbe5a5db), for the $30 target, the earlier $38 to $44 estimate and the mold and certification ranges

* [LIS2DH12 accelerometer, $1.01 at 1,000 and $0.91 on an 8,000 reel](https://www.digikey.com/en/products/detail/stmicroelectronics/LIS2DH12TR/4899838), DigiKey
