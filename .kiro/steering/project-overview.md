---
inclusion: always
---

# Smart Inventory Optimization — Project Overview

## Purpose

Smart Inventory Optimization is a web application that helps small-to-medium retail and wholesale businesses manage their product inventory more effectively. It provides a clear, data-driven dashboard that shows current stock levels, how long that stock will last at recent sales rates, when to reorder, and how much to order.

All calculations are performed with fully transparent, deterministic formulas. No machine-learning models, probabilistic forecasting, or AI predictions are used or claimed. Every number on screen can be traced back to a formula and the raw data that fed it.

## Target Users

- **Store managers and owners** who manually track stock in spreadsheets today and want a single, always-current view of inventory health.
- **Purchasing staff** who decide when to place supplier orders and need a defensible, explainable suggested order quantity.
- **Student teams and evaluators** who need to understand and audit every calculation in the application.

## Challenge Context

This project is a submission for the **AWS Kiro AI-DLC Challenge**. The application is built as a student-level MVP that demonstrates good software-engineering practices, clean architecture, and honest communication about what the tool does and does not do.

## Scope of the MVP

1. Product management: add, edit, view, and delete products (name, SKU, current stock, supplier lead time, safety stock, target coverage days).
2. Daily sales entry for each product.
3. Inventory dashboard showing, per product: current stock, 7-day average daily demand, 3-day average daily demand, stock coverage in days, reorder point, and status.
4. Reorder alerts and a suggested order quantity with a full formula trace visible to the user.
5. A built-in demo dataset that illustrates a product trending toward a stockout before supplier delivery arrives.
