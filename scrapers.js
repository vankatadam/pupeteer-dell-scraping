const pupeteer = require('puppeteer');
var fs = require('fs');
var csvWriter = require('csv-write-stream');
const { mainModule } = require('process');

// workaround with iPhone emulator because of problems with dell page
const iPhone = pupeteer.devices['iPhone 6'];

//call our main function to start reading the needed data (Inventar + serviceTag Numbers) and scraping the web
//Disclaimer: this code was written just to function fast, because of low time budget
main();
function main(){
    readServiceTags();
}

// red all servicetags  and readInventarNumbers after completed
function readServiceTags(){ fs.readFile('serviceTags.csv', 'utf8', function (err, inventarNumbersRaw) {
    const serviceTags = inventarNumbersRaw.split(/\r?\n/);
    runScrapes(serviceTags);
});
}

//run all scrapes. Here running as long as we have an inventarNumber     
async function runScrapes(serviceTags) {

    for (i = 0; i < serviceTags.length; i++) {
        //scrape your data
        const serviceDatum = await scrapeLaptop(serviceTags[i]);
        // console.log(serviceDatum);

        //formate your scraped data
        const serviceDatumWithoutWhiteSpace = serviceDatum.trim();
        //start from 13 character (because of the not so proper formate on the website)
        const serviceDatumFormated = serviceDatumWithoutWhiteSpace.slice(13, serviceDatumWithoutWhiteSpace.length).trim();

        //write the scraped output into a csv with 'csv-write-stream'
        //look if file exist, if not create header 
        const finalPathFile = "inventoryDates.csv";
        if (!fs.existsSync(finalPathFile))
            writer = csvWriter({
                headers: ["inventarNumber", "serviceDatumFormated"]
            });
        else
            writer = csvWriter({
                sendHeaders: false
            });

        // put an 'a' flag, so that we can append to an existing file and not overwriting it
        writer.pipe(fs.createWriteStream(finalPathFile, {
            flags: 'a'
        }));
        writer.write({
            inventarNumber: serviceTags[i],
            serviceDatum: serviceDatumFormated,
        });
        writer.end();
        console.warn(i + "th Laptop completed with tag: " + serviceTags[i] + " and serviceDatum: " + serviceDatumFormated)
    }
};

async function scrapeLaptop(serviceTagInput) {

    try {
        const browser = await pupeteer.launch();
        const page = await browser.newPage();

        //trying to emulate on iphone because of infinite loading in normal browser
        await page.emulate(iPhone);

        //first site
        console.log("first page complete")
        await page.goto('https://www.dell.com/support/home/de-de');
        await page.setViewport({
            width: 1689,
            height: 1400
        })

        await page.$eval('#inpEntrySelection', (el, value) => el.value = value, serviceTagInput);
        await page.click('#txtSearchEs');
        // workaround instead of await page.waitForNavigation(), because it wasnt working properly on the Dell website 
        await page.waitForTimeout(10000);
        //second site
        console.log("second page complete")

        await page.click('#viewdetails');
        // await page.waitForNavigation();
        await page.waitForTimeout(10000);

        //third site: 
        console.log("third page complete")

        const querry = await page.$('#shippingDateLabel');
        const serviceDatum = await querry.getProperty('textContent');
        if (serviceDatum !== null) {
            const serviceTagString = await serviceDatum.jsonValue();
            await browser.close();
            return serviceTagString
        } else {
            console.log("err in third page")
            await browser.close();
            return "not found";
        }
    } catch {
        console.log("err")
        return "not found";
    }
}