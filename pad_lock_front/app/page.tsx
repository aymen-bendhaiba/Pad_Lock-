import Image from "next/image";
import loginBg from "../public/images/loginBg.png";
import logoHarmony from "../public/images/logoHarmony.png";
import logo from "../public/images/logo.png";
import { LoginForm } from "./login-form";

const stats = [
  { value: "5,200+", label: "Vehicles Connected" },
  { value: "120K+", label: "Trips Tracked Monthly" },
  { value: "98.7%", label: "Lock Security Success Rate" },
  { value: "99.9%", label: "Platform Uptime" },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-[#19191f]">
      <Image
        src={loginBg}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />

      <section className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1500px] grid-cols-1 px-6 py-5 md:grid-cols-[minmax(0,1fr)_430px] md:items-center md:gap-16 md:px-[66px] md:py-0 lg:gap-24">
        <div className="flex flex-col md:min-h-[548px] md:justify-center">
          <div>
            <div className="flex items-center gap-4">
              <Image
                src={logo}
                alt="Administration des Douanes et Impots Indirect logo"
                width={50}
                height={78}
                priority
                className="h-auto w-[46px] shrink-0 md:w-[50px]"
              />
              <p className="max-w-[390px] text-[16px] font-medium leading-[1.22] tracking-normal text-[#14141a] md:text-[17px]">
                Royaume Du Maroc Administration
                <br />
                Des Douanes Et Impots Indirect
              </p>
            </div>

            <div className="mt-16 max-w-[660px] md:mt-14">
              <h1 className="text-[56px] font-bold leading-[1.18] tracking-normal text-[#1b1b22] sm:text-[64px] md:text-[66px] lg:text-[68px]">
                Fleet
                <br />
                Intelligence
                <br />
                Platform
              </h1>
              <p className="mt-5 max-w-[660px] text-[18px] font-normal leading-[1.18] tracking-normal text-[#24242b] md:text-[18px]">
                Monitor, secure, and manage your trucks in real-time with smart
                lock integration.
              </p>
            </div>
          </div>

          <div className="mt-8 md:mt-8">
            <dl className="grid max-w-[660px] grid-cols-2 gap-x-12 gap-y-8 sm:grid-cols-4 sm:gap-x-12 lg:gap-x-14">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <dd className="bg-[linear-gradient(90deg,#0C4E71,#1E9ADA)] bg-clip-text text-[30px] font-bold leading-none tracking-normal text-transparent">
                    {stat.value}
                  </dd>
                  <dt className="text-[14px] font-normal leading-tight text-[#4b4b54]">
                    {stat.label}
                  </dt>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="mx-auto mt-10 w-full max-w-[430px] rounded-[8px] bg-white px-[36px] py-[35px] shadow-[0_1px_2px_rgba(0,0,0,0.18)] md:mt-0 md:min-h-[548px] md:w-full">
          <div className="pt-0">
            <h2 className="text-[25px] font-bold leading-tight tracking-normal text-black">
              Welcome back
            </h2>

            <LoginForm />
          </div>
        </div>

        <footer className="mt-10 flex items-center gap-1.5 text-[10px] font-normal text-[#1f1f24] md:absolute md:bottom-[18px] md:left-[66px] md:mt-0">
          <Image
            src={logoHarmony}
            alt="Harmony Technology logo"
            width={14}
            height={21}
            className="h-[21px] w-auto"
          />
          <span>&copy; 2026 Harmony Technology - All Rights Reserved</span>
        </footer>
      </section>
    </main>
  );
}
