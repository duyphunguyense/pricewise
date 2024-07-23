"use server";

import { revalidatePath } from "next/cache";
import Product from "../models/product.model";
import { connectToDB } from "../mongoose";
import { scrapeAmazonProduct } from "../scraper";
import { getAveragePrice, getHighestPrice, getLowestPrice } from "../utils";
import { User } from "@/types";
import { generateEmailBody, sendEmail } from "../nodemailer";

export async function scrapeAndStoreProduct(productUrl: string) {
    if (!productUrl) return;

    try {
        connectToDB();

        const scrapeProduct = await scrapeAmazonProduct(productUrl);

        if (!scrapeProduct) return;

        let product = scrapeProduct;

        const existingProduct = await Product.findOne({ url: scrapeProduct.url });

        if (existingProduct) {
            const updatedPriceHistory: any = [
                ...existingProduct.priceHistory,
                { price: scrapeProduct.currentPrice }
            ];

            product = {
                ...scrapeProduct,
                priceHistory: updatedPriceHistory,
                lowestPrice: getLowestPrice(updatedPriceHistory),
                highestPrice: getHighestPrice(updatedPriceHistory),
                averagePrice: getAveragePrice(updatedPriceHistory),
            };
        }

        const newProduct = await Product.findOneAndUpdate(
            { url: scrapeProduct.url }, //filter product
            product, //update product
            { upsert: true, new: true } //create new product when needed
        );

        revalidatePath(`/products/${newProduct.id}`);
    } catch (error: any) {
        throw new Error(`Failed to create/update product: ${error.message}`);
    }
}

export async function getProductById(productId: string) {
    try {
        connectToDB();

        const product = await Product.findOne({ _id: productId });

        if (!product) return null;

        return product;
    } catch (error) {
        console.log(error);
    }
}

export async function getAllProducts() {
    try {
        connectToDB();

        const products = await Product.find();

        return products;
    } catch (error) {
        console.log(error);
    }
}

export async function getSimilarProducts(productId: string) {
    try {
        connectToDB();

        const currenProduct = await Product.findById(productId);

        if (!currenProduct) return null;

        const products = await Product.find({
            _id: { $ne: productId }
        }).limit(3);

        return products;
    } catch (error) {
        console.log(error);
    }
}

export async function addUserEmailToProduct(productId: string, userEmail: string) {
    try {
        connectToDB();
        const product = await Product.findById(productId);

        if (!product) return;

        const userExists = product.users.some((user: User) => user.email === userEmail);

        if (!userExists) {
            product.users.push({ email: userEmail });

            await product.save();

            const emailContent = await generateEmailBody(product, "WELCOME");

            await sendEmail(emailContent, [userEmail]);
        }

    } catch (error) {
        console.log(error);
    }
}