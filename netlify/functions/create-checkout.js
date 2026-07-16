const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const fetch = require("node-fetch");

exports.handler = async (event) => {
  try {
    const data = JSON.parse(event.body);

    // Base prices
    const basePrices = {
      classic: 45,
      romantic: 75,
      celebration: 95,
      family: 65,
      corporate: 0
    };

    let amount = basePrices[data.package] || 45;

    // Extras
    const extras = data.extras || [];
    extras.forEach((extra) => {
      if (extra === "flowers") amount += 15;
      if (extra === "games") amount += 10;
      if (extra === "cake") amount += 25;
    });

    // Convert to cents
    const amountInCents = amount * 100;

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "ideal"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "PerfectPicnic Amsterdam – " + (data.package || "Picnic"),
              description: `Date: ${data.date}, Time: ${data.time}, People: ${data.people}, Extras: ${extras.join(", ") || "none"}`
            },
            unit_amount: amountInCents
          },
          quantity: 1
        }
      ],
      customer_email: data.email,
      success_url: process.env.SUCCESS_URL || "https://verdant-buttercream-7dc65b.netlify.app/?success=true",
      cancel_url: process.env.CANCEL_URL || "https://verdant-buttercream-7dc65b.netlify.app/?cancel=true"
    });

    // Telegram notification
    const message = `
New picnic booking request:
Name: ${data.name}
Email: ${data.email}
Phone: ${data.contact}
Package: ${data.package}
Date: ${data.date}
Time: ${data.time}
People: ${data.people}
Extras: ${extras.join(", ") || "none"}
Estimated total: €${amount}
Stripe checkout: ${session.url}
`;

    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${process.env.TELEGRAM_CHAT_ID}&text=${encodeURIComponent(
          message
        )}`
      );
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url })
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to create checkout session" })
    };
  }
};

