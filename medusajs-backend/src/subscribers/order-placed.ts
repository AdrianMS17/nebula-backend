import { 
  type SubscriberConfig, 
  type SubscriberArgs,
} from "@medusajs/medusa"
import { Resend } from 'resend';

export default async function handleOrderPlaced({ 
  data, 
  eventName, 
  container, 
  pluginOptions, 
}: SubscriberArgs<Record<string, any>>) {
  
  // 1. Recuperamos el pedido
  const orderService = container.resolve("orderService")
  const order = await orderService.retrieve(data.id, {
    relations: ["items", "shipping_address", "payments"],
  })

  // 2. Preparamos Resend
  const resend = new Resend(process.env.RESEND_API_KEY);

  // 3. Calculamos totales reales (Medusa guarda sin IVA)
  // Truco: Si el total viene vacío, lo sumamos nosotros o usamos el pago
  let finalTotal = order.total;
  if (!finalTotal && order.payments?.length) {
      finalTotal = order.payments[0].amount;
  }
  
  // Formateamos el HTML de los items (añadiendo IVA visualmente x1.21 si es necesario)
  // Ojo: Esto es una aproximación visual para el email.
  const itemsHtml = order.items.map(item => {
    const priceWithTax = (item.unit_price * 1.21) / 100; // Asumiendo 21% IVA
    return `<li style="margin-bottom: 10px;">
       <strong>${item.title}</strong> x ${item.quantity}<br>
       <span style="color: #94a3b8;">${priceWithTax.toFixed(2)} €</span>
     </li>`;
  }).join("");

  // Total formateado
  const totalDisplay = finalTotal ? (finalTotal / 100).toFixed(2) : "0.00";

  // 4. Enviamos el email
  try {
    const response = await resend.emails.send({
      from: 'Nebula Store <onboarding@resend.dev>',
      to: [order.email],
      subject: `Confirmación de pedido #${order.display_id}`,
      html: `
        <div style="background-color: #0f172a; color: white; padding: 40px; font-family: sans-serif;">
          <h1 style="color: #22d3ee; margin-top: 0;">Misión Confirmada 🚀</h1>
          <p style="font-size: 16px;">Hola, tripulante.</p>
          <p>Hemos recibido tus credenciales y tu pedido está asegurado en nuestra bodega de carga.</p>
          <p>Identificador de misión: <strong style="color: #22d3ee;">#${order.display_id}</strong></p>
          
          <div style="background-color: #1e293b; padding: 25px; border-radius: 12px; margin: 30px 0; border: 1px solid #334155;">
            <h3 style="margin-top: 0; color: #e2e8f0; border-bottom: 1px solid #334155; padding-bottom: 10px;">Resumen de carga</h3>
            <ul style="list-style: none; padding: 0; margin: 0;">
              ${itemsHtml}
            </ul>
            <div style="margin-top: 20px; border-top: 1px solid #334155; padding-top: 15px; text-align: right;">
              <span style="color: #94a3b8; margin-right: 10px;">Total (IVA inc.):</span>
              <span style="font-size: 24px; font-weight: bold; color: #22d3ee;">${totalDisplay} €</span>
            </div>
          </div>

          <p style="font-size: 14px; color: #64748b; text-align: center; margin-top: 40px;">
            Nebula Digital Store &copy; 2026<br>
            <span style="font-size: 12px;">Sistema de notificación automática.</span>
          </p>
        </div>
      `,
    }) as any;

    console.log("Email enviado con éxito a:", order.email);

  } catch (err) {
    console.error("Fallo crítico enviando email:", err);
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
  context: {
    subscriberId: "order-placed-handler",
  },
}