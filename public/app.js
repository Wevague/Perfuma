const addressRadios = document.querySelectorAll('input[name="selectedAddress"]');
let selectedAddress = null
addressRadios.forEach(radio => {
  radio.addEventListener('change', (event) => {
    selectedAddress = event.target.value;
    console.log('Selected Address ID:', selectedAddress);

  });
});

const couponDropdown = document.getElementById('couponDropdown');
let couponCode = ''
couponDropdown.addEventListener('change', async function() {
      couponCode = couponDropdown.value;
})


window.paypal
  .Buttons({
    funding : {
      disallowed :[paypal.FUNDING.CARD]
    },
    displayOnly: ["vaultable"],
    

    onCancel(data) {
      console.log(data);
      
      const orderId = data.orderID; 

      console.log(orderId);
      
  
      console.log("paypal orderId", orderId);
  
      fetch(`/updateOrderStatus/${orderId}`, {
          method: 'POST', 
          headers: {
              'Content-Type': 'application/json', 
          },
          body: JSON.stringify({
              status: 'payment failed', 
          }),
      })
      .then(response => response.json())
      .then(data => {
          if (data.success) {
              window.location.assign('/orderconfirm');
          } else {
              alert("Error updating the order status");
          }
      })
      .catch(error => {
          console.error("Error:", error);
      });
  },
    

    async createOrder() {
      if (!selectedAddress) {
        alert('Please select a address')
        return
      }
      try {
        const response = await fetch("/paypal/place-order", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          // use the "body" param to optionally pass additional order information
          // like product ids and quantities
          body: JSON.stringify({
            selectedAddress,
            couponCode
          }),
        });

        const orderData = await response.json();
        console.log(orderData)
        if (orderData.id) {
          return orderData.id;
        }
        const errorDetail = orderData?.details?.[0];
        const errorMessage = errorDetail
          ? `${errorDetail.issue} ${errorDetail.description} (${orderData.debug_id})`
          : JSON.stringify(orderData);

        throw new Error(errorMessage);
      } catch (error) {
        console.error(error);
        // resultMessage(`Could not initiate PayPal Checkout...<br><br>${error}`);
      }
    },

    async onApprove(data, actions) {
      console.log(data)
      try {
        const response = await fetch(
          `/paypal/orders/${data.orderID}/capture`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        const orderData = await response.json();
        // Three cases to handle:
        //   (1) Recoverable INSTRUMENT_DECLINED -> call actions.restart()
        //   (2) Other non-recoverable errors -> Show a failure message
        //   (3) Successful transaction -> Show confirmation or thank you message

        const errorDetail = orderData?.details?.[0];

        if (errorDetail?.issue === "INSTRUMENT_DECLINED") {
          // (1) Recoverable INSTRUMENT_DECLINED -> call actions.restart()
          // recoverable state, per
          // https://developer.paypal.com/docs/checkout/standard/customize/handle-funding-failures/
          return actions.restart();
        } else if (errorDetail) {
          // (2) Other non-recoverable errors -> Show a failure message
          throw new Error(
            `${errorDetail.description} (${orderData.debug_id})`
          );
        } else if (!orderData.purchase_units) {
          throw new Error(JSON.stringify(orderData));
        } else {
          // (3) Successful transaction -> Show confirmation or thank you message
          // Or go to another URL:  actions.redirect('thank_you.html');
          const transaction =
            orderData?.purchase_units?.[0]?.payments
              ?.captures?.[0] ||
            orderData?.purchase_units?.[0]?.payments
              ?.authorizations?.[0];
          console.log(
            `Transaction ${transaction.status}: ${transaction.id}<br>
          <br>See console for all available details`
          );
          console.log(
            "Capture result",
            orderData,
            JSON.stringify(orderData, null, 2)
          );
          window.location.href = '/orderconfirm'
        }
      } catch (error) {
        console.error(error);
       
      }
    },
  })
  .render("#paypal-button-container");
