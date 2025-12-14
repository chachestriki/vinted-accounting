import Image from "next/image";
import TestimonialsAvatars from "./TestimonialsAvatars";
import config from "@/config";
import ButtonLead from "@/components/ButtonLead";
import ButtonCheckout from "@/components/ButtonCheckout";
import ButtonSignin from "@/components/ButtonSignin";

const Hero = () => {
  return (
    <section className="max-w-7xl mx-auto bg-base-100 flex flex-col lg:flex-row items-center justify-center gap-16 lg:gap-20 px-8 py-8 lg:py-20">
      <div className="flex flex-col gap-10 lg:gap-14 items-center justify-center text-center lg:text-left lg:items-start">
        <h1 className="font-extrabold text-4xl lg:text-6xl tracking-tight md:-mb-4">
        Deja de adivinar tus ganancias.
        </h1>
        <p className="text-lg opacity-80 leading-relaxed">
        La plataforma de contabilidad creada exclusivamente para revendedores. Controla cada venta, gasto y beneficio de tu reventa en un solo lugar.

        </p>
        <ButtonCheckout priceId={config.stripe.plans[0].priceId} />
        

        <TestimonialsAvatars priority={true} />
      </div>
      <div className="lg:w-full">
        <video
          className="lg:w-full h-[420px] overflow-hidden bg-white"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
        >
          <source src="/openart-video.mp4" type="video/mp4" />
          Tu navegador no soporta videos HTML5.
        </video>
      </div>

    </section>
  );
};

export default Hero;
