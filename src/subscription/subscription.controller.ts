import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { Request } from 'express';

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post('customers')
  async createCustomer(@Body('email') email: string) {
    return this.subscriptionService.createCustomer(email);
  }

  @Get('customers/:id')
  async getCustomer(@Param('id') id: string) {
    return this.subscriptionService.getCustomer(id);
  }

  @Get('customers')
  async getCustomers() {
    return this.subscriptionService.getCustomers();
  }

  @Get('products')
  async getProducts() {
    return this.subscriptionService.getProducts();
  }

  @Get('prices')
  async getPrices() {
    return this.subscriptionService.getPrices();
  }

  @Get('success')
  handleSuccess() {
    return 'Subscription was successful!';
  }

  @Get('cancel')
  handleCancel() {
    return 'Subscription was canceled!';
  }

  @Post('create')
  async createSubscriptionSession(
    @Body() { customerId, priceId }: { customerId: string; priceId: string },
  ) {
    return this.subscriptionService.createSubscriptionSession(
      customerId,
      priceId,
    );
  }

  @Post('update')
  async createSubscriptionUpdateSession(
    @Body()
    { customerId, newPriceId }: { customerId: string; newPriceId: string },
  ) {
    return this.subscriptionService.createSubscriptionUpdateSession(
      customerId,
      newPriceId,
    );
  }

  @Post('current')
  async getCurrentSubscription(@Body() { customerId }: { customerId: string }) {
    return this.subscriptionService.getCurrentSubscription(customerId);
  }

  @Post('webhook')
  async handleStripeWebhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.subscriptionService.handleStripeWebhook(req, signature);
  }
}

// This script is used to integrate Stripe Checkout on the client side.
// It includes a "Subscribe" button that, when clicked, initiates the Stripe Checkout session creation process.
// Once the session is created, the user is redirected to the Stripe Checkout payment page.

// <script src="https://js.stripe.com/v3/"></script>

// <button id="checkout-button">Subscribe</button>

// <script>
//   var stripe = Stripe('your_public_key');  // public key here

//   document.getElementById('checkout-button').addEventListener('click', function () {
//     fetch('/subscription/create-checkout-session', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ customerId: 'customer_id_here', priceId: 'price_id_here' }),
//     })
//       .then(function (response) {
//         return response.json();
//       })
//       .then(function (sessionId) {
//         return stripe.redirectToCheckout({ sessionId: sessionId.id }); // redirect to checkout page
//       })
//       .then(function (result) {
//         if (result.error) {
//           alert(result.error.message);
//         }
//       })
//       .catch(function (error) {
//         console.error('Error:', error);
//       });
//   });
// </script>
