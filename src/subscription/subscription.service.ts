import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import Stripe from 'stripe';

@Injectable()
export class SubscriptionService {
  private stripe: Stripe;

  constructor(private configService: ConfigService) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY'),
      {
        apiVersion: '2024-11-20.acacia',
      },
    );
  }

  async createCustomer(email: string) {
    return this.stripe.customers.create({
      email,
    });
  }

  async getCustomer(id: string) {
    return this.stripe.customers.retrieve(id);
  }

  async getCustomers() {
    return this.stripe.customers.list();
  }

  async getProducts() {
    return this.stripe.products.list();
  }

  async getPrices() {
    return this.stripe.prices.list();
  }

  async createSubscriptionSession(customerId: string, priceId: string) {
    try {
      const hasActiveSubscription =
        await this.checkActiveSubscription(customerId);

      if (hasActiveSubscription) {
        throw new BadRequestException(
          'Customer already has an active subscription',
        );
      }

      const session = await this.stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: 'http://localhost:3000/subscription/success',
        cancel_url: 'http://localhost:3000/subscription/cancel',
      });

      return session.id;
    } catch (error) {
      throw error;
    }
  }

  async createSubscriptionUpdateSession(
    customerId: string,
    newPriceId: string,
  ) {
    const activeSubscription = await this.checkActiveSubscription(customerId);

    if (!activeSubscription) {
      throw new BadRequestException(
        'No active subscription found for customer',
      );
    }

    if (activeSubscription.data[0].items.data[0].price.id === newPriceId) {
      throw new BadRequestException('Customer already has this subscription');
    }

    try {
      const session = await this.stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [
          {
            price: newPriceId,
            quantity: 1,
          },
        ],
        success_url: 'http://localhost:3000/subscription/success',
        cancel_url: 'http://localhost:3000/subscription/cancel',
      });

      return session.id;
    } catch (error) {
      throw error;
    }
  }

  async getCurrentSubscription(customerId: string) {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: 'http://localhost:3000',
    });

    return session.url;
  }

  async handleStripeWebhook(
    req: Request,
    signature: string,
  ): Promise<{ status: string }> {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        req['rawBody'],
        signature,
        this.configService.get<string>('STRIPE_WEBHOOK_SECRET'),
      );
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return { status: 'error' };
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(
          event.data.object as Stripe.Invoice,
        );
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return { status: 'success' };
  }

  private async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const customerId = session.customer as string;
    const subscriptions = await this.stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
    });

    if (subscriptions.data.length > 1) {
      const previousSubscription = subscriptions.data[1];
      await this.stripe.subscriptions.cancel(previousSubscription.id);
      console.log(`Previous subscription ${previousSubscription.id} deleted`);
    }

    console.log('Session completed');
  }

  private async handleInvoicePaymentSucceeded(
    invoice: Stripe.Invoice,
  ): Promise<void> {
    const customerId = invoice.customer as string;
    const paymentIntentId = invoice.payment_intent as string;

    if (paymentIntentId) {
      const paymentIntent =
        await this.stripe.paymentIntents.retrieve(paymentIntentId);
      const paymentMethodId = paymentIntent.payment_method as string;

      const customer = (await this.stripe.customers.retrieve(
        customerId,
      )) as Stripe.Customer;

      if (
        customer.invoice_settings &&
        !customer.invoice_settings.default_payment_method
      ) {
        await this.stripe.customers.update(customer.id, {
          invoice_settings: { default_payment_method: paymentMethodId },
        });
        console.log(
          `Default payment method for customer ${customerId} set to ${paymentMethodId}`,
        );
      }
    }

    console.log('Invoice payment succeeded');
  }

  private async checkActiveSubscription(customerId: string) {
    const subscriptions = await this.stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
    });

    return subscriptions.data.length === 0 ? false : subscriptions;
  }
}
