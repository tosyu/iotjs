#include <SPI.h>

const int GPIO_IN = 7;
const int GPIO_OUT = 8;
const int GPIO_DELAY = 1000;
const int MISO_PIN = 12;
int gpioVal = 0;

void setup() {
  Serial.begin(115200);
  // GPIO TEST SETUP
  pinMode(GPIO_IN, INPUT);
  pinMode(GPIO_OUT, OUTPUT);

  // SPI TEST SETUP
  pinMode(MISO_PIN, OUTPUT);
  SPCR |= _BV(SPE);
  SPCR |= _BV(SPIE);
  SPI.attachInterrupt();
}

// @TEST: SPI ECHO
ISR (SPI_STC_vect) {
  byte c = SPDR; // grab data
  SPDR = c; // send back
}

void loop(){
  // @TEST: GPIO ECHO
  gpioVal = digitalRead(GPIO_IN);
  digitalWrite(GPIO_OUT, gpioVal);
  delay(GPIO_DELAY);
  digitalWrite(GPIO_OUT, !gpioVal);
}

