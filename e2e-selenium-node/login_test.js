// import chromedriver so that selenium can by itself open a chrome driver
//require("chromedriver");

// import this class from selenium
const { Builder, By, Key, until } = require('selenium-webdriver');

(async function openChromeTest() {
  // open chrome browser
  let driver = await new Builder().forBrowser("chrome").build();

  try {
    // go to example website
    await driver.get("http://localhost:3000/");

    // Find the username and password input fields and enter values
    await driver.findElement(By.id('username')).sendKeys('cloellen');
    await driver.findElement(By.id('password')).sendKeys('1234');

    // Submit the form
    await driver.findElement(By.tagName('form')).submit();

    await driver.wait(until.titleIs('Welcome'), 10000);

    let welcomeMessage = await driver.findElement(By.tagName('p')).getText();
    if (welcomeMessage === 'Welcome back') {
      console.log('Login successful');
    } else {
      console.log('Login failed');
    }
  } finally {
    // close the chrome browser
    await driver.quit();
  }
})();