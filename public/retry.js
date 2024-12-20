
document.addEventListener('DOMContentLoaded', function () {
  const orderIdEl = document.getElementById('order-id');
  console.log("orderIdEl",orderIdEl);
  
  const orderId = orderIdEl ? orderIdEl.innerText : null; // Get order ID from the page element


  console.log('PayPal button rendering...');

  // Check if the order ID exists on the page
  if (orderId) {
    window.paypal
      .Buttons({
        displayOnly: ["vaultable"],

        // Retry logic to create a new order on the server when retrying payment
        async createOrder() {
          if (!orderId) {
            alert("Order ID not found.");
            return;
          }

          try {
            // Send request to server to create a new order for retry
            const response = await fetch(`/paypal/payment/retry/${orderId}`, {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
            });

            const orderData = await response.json();
            console.log(orderData);

            if (orderData.id) {
              return orderData.id; // Return the new PayPal order ID
            }

            const errorDetail = orderData?.details?.[0];
            const errorMessage = errorDetail
              ? `${errorDetail.issue} ${errorDetail.description} (${orderData.debug_id})`
              : JSON.stringify(orderData);

            throw new Error(errorMessage); // Throw error if creating order fails
          } catch (error) {
            console.error("Error during order creation:", error);
            alert("Failed to create PayPal order.");
          }
        },

        // Logic to handle payment approval
        async onApprove(data, actions) {
          console.log("Payment approved:", data);
          try {
            const response = await fetch(
              `/paypal/orders/${data.orderID}/capture-retry`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
              }
            );

            const orderData = await response.json();
            const errorDetail = orderData?.details?.[0];

            if (errorDetail?.issue === "INSTRUMENT_DECLINED") {
              // Handle the recoverable error
              return actions.restart();
            } else if (errorDetail) {
              // Handle other errors
              throw new Error(`${errorDetail.description} (${orderData.debug_id})`);
            } else if (!orderData.purchase_units) {
              throw new Error("Invalid order data.");
            } else {
              // Successful payment, show confirmation
              const transaction =
                orderData?.purchase_units?.[0]?.payments?.captures?.[0] ||
                orderData?.purchase_units?.[0]?.payments?.authorizations?.[0];
              console.log(`Transaction ${transaction.status}: ${transaction.id}`);

              // Redirect to the order confirmation page
              window.location.href = '/Orderlist';
            }
          } catch (error) {
            console.error("Error during capture:", error);
            alert("Error during payment capture.");
          }
        },

        // Optionally, handle the cancellation
        onCancel(data) {
          console.log("Payment cancelled", data);
          // Handle the cancellation if needed
        },
      })
      .render("#paypal-button-container");
  } else {
    console.error("Order ID not found on the page.");
  }
});
