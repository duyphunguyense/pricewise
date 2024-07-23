import axios from "axios";
import * as cheerio from "cheerio";
import { extractCurrency, extractDescription, extractDiscountRate, extractPrice } from "../utils";

export async function scrapeAmazonProduct(url: string) {
    if (!url) return;

    //BrightData proxy configuration
    const username = String(process.env.BRIGHT_DATA_USERNAME);
    const password = String(process.env.BRIGHT_DATA_PASSWORD);
    const port = 22225;
    const session_id = (1000000 * Math.random()) | 0;
    const options = {
        auth: {
            username: `${username}-session-${session_id}`,
            password
        },
        host: 'brd.superproxy.io',
        port,
        rejectUnauthorized: false,
    };

    try {
        //Fetch the product page
        const response = await axios.get(url, options);
        const $ = cheerio.load(response.data);

        //Extract the product
        const title = $('#productTitle').text().trim();
        const currentPrice = extractPrice(
            $('.a-price.aok-align-center span.a-offscreen'),
            $('.priceToPay span.a-price-whole'),
            $('.a.size.base.a-color-price'),
            $('.a-button-selected .a-color-base'),
            $('.a-price.a-text-price .a-offscreen'), //add .a-offscreen
        );

        const originalPrice = extractPrice(
            $('#corePriceDisplay_desktop_feature_div > div.a-section.a-spacing-small.aok-align-center > span > span.aok-relative > span.a-size-small.a-color-secondary.aok-align-center.basisPrice > span > span.a-offscreen'),
            $('#priceblock_ourprice'),
            $('.a-price.a-text-price span.a-offscreen'),
            $('#listPrice'),
            $('#priceblock_dealprice'),
            $('.a-size-base.a-color-price')
        );

        const outOfStock = $('#availability span').text().trim().toLowerCase() === 'currently unavailable';

        const images =
            $('#imgBlkFront').attr('data-a-dynamic-image') ||
            $('#landingImage').attr('data-a-dynamic-image') ||
            '{}';

        const imageUrls = Object.keys(JSON.parse(images));

        //need to scroll down to load the product
        const currency = extractCurrency($('.a-price-symbol'));
        const discountRate = extractDiscountRate($('.savingsPercentage'));

        const description = extractDescription($);

        const data = {
            url,
            title,
            description,
            currentPrice: Number(currentPrice) || Number(originalPrice),
            originalPrice: Number(originalPrice) || Number(currentPrice),
            isOutOfStock: outOfStock,
            image: imageUrls[0],
            currency: currency || '$',
            discountRate: Number(discountRate),
            lowestPrice: Number(currentPrice) || Number(originalPrice),
            highestPrice: Number(originalPrice) || Number(currentPrice),
            averagePrice: Number(currentPrice) || Number(originalPrice),
            priceHistory: [],
            category: 'category',
            reviewsCount: 100,
            stars: 4.5,
        };

        return data;
    } catch (error: any) {
        throw new Error(`Failed to scrape product: ${error.message}`);
    }
}