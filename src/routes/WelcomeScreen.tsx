import {
  Star,
  TrendingUp,
  Users,
  Shield,
  Zap,
  Globe,
  Lock,
  Hexagon,
  Triangle,
  Circle,
  Diamond,
  Brain,
  Cpu,
  Network,
  Bot,
} from "lucide-react";
import React, { useEffect, useState } from "react";

const WelcomeScreen: React.FC = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isLoaded, setIsLoaded] = useState(false);
  const [time, setTime] = useState(0);

  
  

  

  useEffect(() => {
    setIsLoaded(true);
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    const timer = setInterval(() => {
      setTime((prev) => prev + 1);
    }, 100);

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      clearInterval(timer);
    };
  }, []);

  const features = [
    { icon: TrendingUp, title: "High Yield Staking", description: "Earn up to 25% APY with our premium DeFi packages", gradient: "from-emerald-400 to-cyan-400", particles: "emerald" },
    { icon: Users, title: "15-Level Network", description: "Build exponential wealth through our multi-tier system", gradient: "from-purple-400 to-pink-400", particles: "purple" },
    { icon: Shield, title: "Blockchain Security", description: "Smart contract audited and fully decentralized", gradient: "from-blue-400 to-indigo-400", particles: "blue" },
    { icon: Zap, title: "Instant Rewards", description: "Real-time earnings with automated distribution", gradient: "from-orange-400 to-red-400", particles: "orange" },
  ];

  const stats = [
    { label: "Total Value Locked", value: "$2.5M+", icon: Lock, color: "purple" },
    { label: "Active Stakers", value: "1,247+", icon: Users, color: "blue" },
    { label: "Max APY", value: "25%", icon: TrendingUp, color: "green" },
    { label: "Networks", value: "15+", icon: Globe, color: "orange" },
  ];

  const FloatingShape = ({ shape, color, size, delay, duration }: { shape: React.ElementType; color: string; size: string; delay: number; duration: number; }) => {
    const ShapeIcon = shape;
    return (
      <div className={`absolute opacity-20 animate-float`}
        style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, animationDelay: `${delay}s`, animationDuration: `${duration}s`, transform: `rotate(${time * 2}deg)` }}>
        <ShapeIcon className={`w-${size} h-${size} text-${color}-400`} />
      </div>
    );
  };

  const AIFloatingObject = ({ icon: Icon, color, size, delay, duration }: { icon: React.ElementType; color: string; size: string | number; delay: number; duration: number; }) => {
    return (
      <div className={`absolute opacity-30 animate-float`}
        style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, animationDelay: `${delay}s`, animationDuration: `${duration}s`, transform: `rotate(${Math.sin(time * 0.02 + delay) * 30}deg) scale(${1 + Math.sin(time * 0.03 + delay) * 0.2})` }}>
        <div className={`relative w-${size} h-${size}`}>
          <div className={`absolute inset-0 bg-${color}-400 rounded-full blur-lg opacity-50 animate-pulse`} />
          <div className={`relative w-full h-full bg-gradient-to-br from-${color}-500 to-${color}-600 rounded-full flex items-center justify-center`}>
            <Icon className={`w-${Math.floor(Number(size) / 2)} h-${Math.floor(Number(size) / 2)} text-white animate-pulse`} />
          </div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`absolute w-1 h-8 bg-${color}-400 opacity-60`}
                 style={{ left: "50%", top: "50%", transform: `translate(-50%, -50%) rotate(${120 * i + time * 3}deg) translateY(-${Number(size) * 2}px)`, transformOrigin: "center bottom" }} />
          ))}
          {[...Array(4)].map((_, i) => (
            <div key={`neural-${i}`} className={`absolute w-px h-12 bg-gradient-to-t from-${color}-400 to-transparent opacity-40`}
                 style={{ left: "50%", top: "50%", transform: `translate(-50%, -50%) rotate(${90 * i + time * 1.5}deg) translateY(-${Number(size) * 1.5}px)`, transformOrigin: "center bottom" }} />
          ))}
        </div>
      </div>
    );
  };

  const ParticleField = ({ count, color }: { count: number; color: string; }) => (
    <>
      {[...Array(count)].map((_, i) => (
        <div key={i}
          className={`absolute w-1 h-1 bg-${color}-400 rounded-full animate-pulse`}
          style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 3}s`, animationDuration: `${1 + Math.random() * 2}s`, transform: `translate(${Math.sin(time * 0.1 + i) * 20}px, ${Math.cos(time * 0.1 + i) * 20}px)` }} />
      ))}
    </>
  );

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Dynamic Animated Background */}
      <div className="absolute inset-0">
        <div className="absolute w-[600px] h-[600px] rounded-full opacity-30 blur-3xl animate-pulse-slow"
             style={{ background: "radial-gradient(circle, rgba(139,92,246,0.8) 0%, rgba(59,130,246,0.6) 50%, transparent 100%)", left: `${mousePosition.x * 0.03}px`, top: `${mousePosition.y * 0.03}px`, transform: "translate(-50%, -50%)", animation: "pulse 4s ease-in-out infinite" }} />
        <div className="absolute w-[500px] h-[500px] rounded-full opacity-25 blur-3xl animate-pulse-slow"
             style={{ background: "radial-gradient(circle, rgba(16,185,129,0.7) 0%, rgba(6,182,212,0.5) 50%, transparent 100%)", right: `${mousePosition.x * 0.02}px`, bottom: `${mousePosition.y * 0.02}px`, transform: "translate(50%, 50%)", animationDelay: "1s" }} />
        <div className="absolute w-[400px] h-[400px] rounded-full opacity-20 blur-3xl animate-pulse-slow"
             style={{ background: "radial-gradient(circle, rgba(245,158,11,0.6) 0%, rgba(239,68,68,0.4) 50%, transparent 100%)", left: "10%", top: "70%", animationDelay: "2s" }} />
        <div className="absolute inset-0 opacity-10">
          <div className="w-full h-full"
               style={{ backgroundImage: "linear-gradient(rgba(139, 92, 246, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 92, 246, 0.4) 1px, transparent 1px)", backgroundSize: "60px 60px", transform: `translate(${Math.sin(time * 0.01) * 10}px, ${Math.cos(time * 0.01) * 10}px)` }} />
        </div>
        <div className="absolute inset-0 opacity-5">
          <div className="w-full h-full"
               style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%238B5CF6' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")", transform: `rotate(${time * 0.5}deg)` }} />
        </div>
      </div>

      {/* AI Floating Objects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <AIFloatingObject icon={Brain} color="purple" size="12" delay={0} duration={8} />
        <AIFloatingObject icon={Cpu} color="blue" size="10" delay={1} duration={10} />
        <AIFloatingObject icon={Network} color="green" size="8" delay={2} duration={12} />
        <AIFloatingObject icon={Bot} color="orange" size="14" delay={3} duration={9} />
        <AIFloatingObject icon={Brain} color="pink" size="9" delay={4} duration={11} />
        <AIFloatingObject icon={Cpu} color="cyan" size="11" delay={5} duration={7} />

        <FloatingShape shape={Hexagon} color="purple" size="8" delay={0} duration={8} />
        <FloatingShape shape={Triangle} color="blue" size="6" delay={1} duration={10} />
        <FloatingShape shape={Circle} color="green" size="4" delay={2} duration={12} />
        <FloatingShape shape={Diamond} color="orange" size="5" delay={3} duration={9} />
        <FloatingShape shape={Star} color="pink" size="7" delay={4} duration={11} />

        <ParticleField count={20} color="purple" />
        <ParticleField count={15} color="blue" />
        <ParticleField count={10} color="green" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className={`mb-16 transition-all duration-1000 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
            <h1 className="text-6xl md:text-8xl font-black mb-6 leading-tight">
              <span className="inline-block bg-gradient-to-r from-white via-purple-200 to-cyan-200 bg-clip-text text-transparent">Yearn</span>
              <span className="inline-block bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">X</span>
            </h1>

            <div className="relative mb-8">
              <p className="text-xl md:text-2xl text-gray-300 mb-4 font-light">AI-Powered Decentralized Affiliate Marketing</p>
              <div className="flex items-center justify-center space-x-2 text-sm text-purple-400">
                <Brain className="w-4 h-4 animate-pulse" />
                <span className="animate-pulse">Powered by Smart Contracts & AI</span>
                <Cpu className="w-4 h-4 animate-pulse" style={{ animationDelay: "0.5s" }} />
              </div>
            </div>

            <div className="relative inline-block group">
              <div className="absolute -inset-2 bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 rounded-3xl blur-lg opacity-60 group-hover:opacity-100 transition duration-500 animate-pulse" />
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-2xl opacity-80" />
              <appkit-button></appkit-button>
            </div>
          </div>

          <div className={`mb-16 transition-all duration-1000 delay-300 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {stats.map((stat, index) => (
                <div key={index} className="relative group transform hover:scale-110 transition-all duration-300" style={{ animationDelay: `${index * 100}ms` }}>
                  <div className={`absolute -inset-1 bg-gradient-to-r from-${stat.color}-500 to-${stat.color}-600 rounded-2xl opacity-20 group-hover:opacity-60 transition duration-300 blur animate-pulse`} />
                  <div className="relative bg-gray-900/90 backdrop-blur-xl rounded-2xl p-6 border border-gray-800 hover:border-purple-500/50 transition-all duration-300">
                    <div className="relative">
                      <stat.icon className={`w-8 h-8 text-${stat.color}-400 mx-auto mb-3 animate-bounce`} style={{ animationDelay: `${index * 0.2}s` }} />
                      <div className="text-2xl md:text-3xl font-bold text-white mb-1 animate-pulse">{stat.value}</div>
                      <div className="text-sm text-gray-400">{stat.label}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`mb-16 transition-all duration-1000 delay-500 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-12 animate-pulse">
              Why Choose <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">YearnX</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => (
                <div key={index} className="relative group hover:scale-105 transition-all duration-500 transform hover:-translate-y-2" style={{ animationDelay: `${index * 150}ms` }}>
                  <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl opacity-0 group-hover:opacity-40 transition duration-500 blur animate-pulse" />
                  <div className="relative bg-gray-900/70 backdrop-blur-xl rounded-2xl p-8 border border-gray-800 hover:border-gray-600 transition-all duration-300 h-full overflow-hidden">
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                      {[...Array(8)].map((_, i) => (
                        <div key={i} className={`absolute w-1 h-1 bg-${feature.particles}-400 rounded-full animate-pulse`} style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 2}s` }} />
                      ))}
                      {[...Array(3)].map((_, i) => (
                        <div key={`neural-${i}`} className={`absolute w-px h-8 bg-gradient-to-t from-${feature.particles}-400 to-transparent opacity-30`} style={{ left: `${20 + i * 30}%`, top: `${20 + i * 20}%`, transform: `rotate(${i * 45}deg)`, animationDelay: `${i * 0.5}s` }} />
                      ))}
                    </div>
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 mx-auto group-hover:scale-110 group-hover:rotate-12 transition-all duration-500 animate-float relative`}>
                      <feature.icon className="w-8 h-8 text-white" />
                      <div className="absolute inset-0 bg-white/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-pulse" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-4 group-hover:text-purple-300 transition-colors duration-300">{feature.title}</h3>
                    <p className="text-gray-400 leading-relaxed group-hover:text-gray-300 transition-colors duration-300">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`transition-all duration-1000 delay-700 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
            <div className="relative group">
              <div className="absolute -inset-2 bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 rounded-3xl opacity-30 blur-xl group-hover:opacity-50 transition duration-500 animate-pulse" />
              <div className="relative bg-gray-900/90 backdrop-blur-xl rounded-3xl p-8 border border-gray-800 hover:border-purple-500/50 transition-all duration-300">
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-4 animate-pulse">Ready to Start Your AI-Powered Web3 Journey?</h3>
                <p className="text-gray-300 mb-6 max-w-2xl mx-auto">Join thousands of users earning passive income through our revolutionary AI-enhanced affiliate system. Connect your wallet and start staking today.</p>
                <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
                  <appkit-button label="Get Started Now"></appkit-button>
                  <div className="text-sm text-gray-400 animate-pulse flex items-center space-x-2">
                    <Cpu className="w-4 h-4" />
                    <span>AI-Enhanced • No fees • Instant setup • Secure</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(15)].map((_, i) => (
          <div key={i} className="absolute animate-float"
               style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 5}s`, animationDuration: `${3 + Math.random() * 4}s` }}>
            <div className={`w-2 h-2 bg-gradient-to-r from-purple-400 to-cyan-400 rounded-full opacity-60 animate-pulse relative`}>
              <div className="absolute inset-0 bg-white rounded-full opacity-0 animate-ping" style={{ animationDelay: `${Math.random() * 2}s` }} />
            </div>
          </div>
        ))}
        {[...Array(4)].map((_, i) => (
          <div key={`ai-star-${i}`} className="absolute w-1 h-20 bg-gradient-to-b from-cyan-400 via-purple-400 to-transparent opacity-40"
               style={{ left: `${Math.random() * 100}%`, top: "-20px", transform: `rotate(45deg)`, animation: `shootingStar 3s linear infinite`, animationDelay: `${i * 1.5}s` }} />
        ))}
      </div>

      <style>{`
        @keyframes shootingStar {
          0% { transform: translateY(-100vh) rotate(45deg); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(100vh) rotate(45deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default WelcomeScreen;
