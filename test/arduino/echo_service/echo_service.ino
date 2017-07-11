
const int GPIO_IN = 7;
const int GPIO_OUT = 8;
const int GPIO_DELAY = 1000;
int val = 0;
//const int GPIO_OUT = 13; // for testing

void setup() {
  pinMode(GPIO_IN, INPUT);
  pinMode(GPIO_OUT, OUTPUT);
}


void loop(){
  val = digitalRead(GPIO_IN);
  digitalWrite(GPIO_OUT, val);
  delay(GPIO_DELAY);
  digitalWrite(GPIO_OUT, !val);  
}

