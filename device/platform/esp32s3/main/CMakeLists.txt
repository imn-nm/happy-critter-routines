# The whole child app, unchanged from the simulator build.
set(APP_DIR ${CMAKE_CURRENT_LIST_DIR}/../../../app)
file(GLOB_RECURSE APP_SOURCES ${APP_DIR}/*.c)

idf_component_register(
    SRCS main.c hal_esp32.c ${APP_SOURCES}
    INCLUDE_DIRS . ${APP_DIR} ${APP_DIR}/vendor/cjson
    REQUIRES nvs_flash esp_wifi esp_netif esp_event esp_http_client esp_timer esp_driver_gpio esp_driver_i2c esp-tls mbedtls
    EMBED_TXTFILES ${CMAKE_CURRENT_LIST_DIR}/../../sim/web/demo/school-day.json)

# ESP-IDF turns warnings into errors; GCC warns about things the simulator build (Clang) does not.
target_compile_options(${COMPONENT_LIB} PRIVATE -Wno-error -Wno-unused-function -Wno-format-truncation -Wno-missing-braces)
