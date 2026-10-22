# The whole child app, unchanged from the simulator build.
set(APP_DIR ${CMAKE_CURRENT_LIST_DIR}/../../../app)
file(GLOB_RECURSE APP_SOURCES ${APP_DIR}/*.c)

idf_component_register(
    SRCS main.c hal_esp32.c lv_mem_psram.c ${APP_SOURCES}
    INCLUDE_DIRS . ${APP_DIR} ${APP_DIR}/vendor/cjson
    REQUIRES nvs_flash esp_partition esp_pm esp_wifi esp_netif esp_event esp_http_client esp_timer esp_driver_gpio esp_driver_i2c esp-tls mbedtls
    EMBED_TXTFILES ${CMAKE_CURRENT_LIST_DIR}/../../sim/web/demo/school-day.json
    LDFRAGMENTS linker.lf)

# LVGL calls our allocator (lv_mem_psram.c) but doesn't depend on main, so keep it in the link.
target_link_libraries(${COMPONENT_LIB} INTERFACE "-u lv_malloc_core")

# Effects that draw through a layer of their own every frame (theme.h): the carousel's pyramid
# managed 3 frames a turn on the S3, and the wheels' shrinking rows slowed the day's sheet. The
# board slides the pages flat and fades the rows part by part.
target_compile_definitions(${COMPONENT_LIB} PRIVATE UI_DEPTH=0)

# A test setting (Kconfig): the day runs as if there were no School.
if(CONFIG_MYTOKI_NO_SCHOOL)
    target_compile_definitions(${COMPONENT_LIB} PRIVATE MYTOKI_NO_SCHOOL=1)
endif()

# ESP-IDF turns warnings into errors; GCC warns about things the simulator build (Clang) does not.
target_compile_options(${COMPONENT_LIB} PRIVATE -Wno-error -Wno-unused-function -Wno-format-truncation -Wno-missing-braces)
