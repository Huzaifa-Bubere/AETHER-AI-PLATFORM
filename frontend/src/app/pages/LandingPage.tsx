import { Link } from 'react-router-dom';
import { Brain, Video, MessageSquare, TrendingUp, Upload, PlayCircle, Award, ChevronRight, Check, Star } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

export function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden bg-gradient-to-b from-blue-50 to-white">
        <div className="absolute inset-0 bg-grid-pattern opacity-30"></div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-block">
                <span className="px-4 py-2 bg-blue-100 border border-blue-200 rounded-full text-primary text-sm font-medium">
                  AI-Powered Interview Preparation
                </span>
              </div>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-foreground leading-tight">
                Practice Real Interviews with AI
              </h1>
              <p className="text-xl text-muted-foreground">
                Master your interview skills with AI-powered mock interviews. Get personalized feedback on your communication, technical skills, and confidence.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/signup">
                  <Button variant="primary" size="lg">
                    Start Free Interview
                    <ChevronRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button variant="outline" size="lg">
                    <Upload className="mr-2 w-5 h-5" />
                    Upload Resume
                  </Button>
                </Link>
              </div>
              <div className="flex items-center gap-8 pt-4">
                <div>
                  <div className="flex items-center gap-1 text-yellow-500">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">5.0 from 10k+ users</p>
                </div>
                <div className="h-12 w-px bg-border"></div>
                <div>
                  <p className="text-2xl font-bold text-primary">50K+</p>
                  <p className="text-sm text-muted-foreground">Interviews Conducted</p>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <Card hover>
                <img
                  src="https://images.unsplash.com/photo-1767950467836-ef59566126c3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxBSSUyMHJvYm90JTIwcHJvZmVzc2lvbmFsJTIwaW50ZXJ2aWV3fGVufDF8fHx8MTc2OTg3MTEyM3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                  alt="AI Interviewer"
                  className="w-full h-auto rounded-xl"
                />
                <div className="absolute -bottom-4 -right-4 bg-white border border-border rounded-xl p-4 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                      <Award className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Success Rate</p>
                      <p className="text-xl font-bold text-primary">94%</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Powered by Advanced AI
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Our platform uses cutting-edge AI to simulate real interview scenarios and provide deep insights
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 ">
            {[
              {
                icon: Brain,
                title: 'AI Interviewer',
                description: 'Natural conversation with AI that adapts to your responses',
                color: 'bg-blue-500'
              },
              {
                icon: Upload,
                title: 'Resume-Based Questions',
                description: 'Questions tailored to your experience and skills',
                color: 'bg-purple-500'
              },
              {
                icon: Video,
                title: 'Video & Audio Analysis',
                description: 'Track eye contact, emotion, and speech patterns',
                color: 'bg-pink-500'
              },
              {
                icon: TrendingUp,
                title: 'Personalized Feedback',
                description: 'Detailed reports with improvement suggestions',
                color: 'bg-orange-500'
              }
            ].map((feature, index) => (
              <Card key={index} hover className="p-6">
                <div className={`w-14 h-14 ${feature.color} rounded-xl flex items-center justify-center mb-4`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              How It Works
            </h2>
            <p className="text-xl text-muted-foreground">
              Get started in three simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Upload Resume & Select Role',
                description: 'Upload your resume and choose your target role and experience level',
                icon: Upload
              },
              {
                step: '02',
                title: 'Practice with AI Interviewer',
                description: 'Answer questions via video/audio while AI analyzes your performance',
                icon: PlayCircle
              },
              {
                step: '03',
                title: 'Get Detailed Feedback',
                description: 'Receive comprehensive feedback and improvement roadmap',
                icon: MessageSquare
              }
            ].map((step, index) => (
              <div key={index} className="relative">
                <Card className="h-full p-6">
                  <div className="text-6xl font-bold text-primary opacity-20 mb-4">{step.step}</div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                    <step.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </Card>
                {index < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform translate-x-1/2 -translate-y-1/2">
                    <ChevronRight className="w-8 h-8 text-primary" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Loved by Job Seekers
            </h2>
            <p className="text-xl text-muted-foreground">
              See what our users have to say
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: 'Sarah Johnson',
                role: 'Software Engineer',
                image: 'https://images.unsplash.com/photo-1573497701240-345a300b8d36?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkaXZlcnNlJTIwcGVvcGxlJTIwdGVzdGltb25pYWwlMjBwcm9mZXNzaW9uYWx8ZW58MXx8fHwxNzY5ODcxMTI0fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
                text: 'This platform helped me land my dream job at Google. The AI feedback was incredibly accurate!'
              },
              {
                name: 'Michael Chen',
                role: 'Data Scientist',
                image: 'https://images.unsplash.com/photo-1573497701240-345a300b8d36?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkaXZlcnNlJTIwcGVvcGxlJTIwdGVzdGltb25pYWwlMjBwcm9mZXNzaW9uYWx8ZW58MXx8fHwxNzY5ODcxMTI0fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
                text: 'The video analysis feature is a game-changer. I improved my eye contact and confidence significantly.'
              },
              {
                name: 'Emily Rodriguez',
                role: 'Product Manager',
                image: 'https://images.unsplash.com/photo-1573497701240-345a300b8d36?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkaXZlcnNlJTIwcGVvcGxlJTIwdGVzdGltb25pYWwlMjBwcm9mZXNzaW9uYWx8ZW58MXx8fHwxNzY5ODcxMTI0fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
                text: 'Best investment for interview prep. The personalized feedback saved me months of practice.'
              }
            ].map((testimonial, index) => (
              <Card key={index} hover className="h-full p-6">
                <div className="flex items-center gap-1 text-yellow-500 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-6">"{testimonial.text}"</p>
                <div className="flex items-center gap-3">
                  <img 
                    src={testimonial.image} 
                    alt={testimonial.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-muted-foreground">
              Choose the plan that works for you
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                name: 'Free',
                price: '$0',
                period: 'forever',
                features: [
                  '3 interviews per month',
                  'Basic feedback',
                  'Resume analysis',
                  'Email support'
                ],
                cta: 'Get Started',
                popular: false
              },
              {
                name: 'Pro',
                price: '$29',
                period: 'per month',
                features: [
                  'Unlimited interviews',
                  'Advanced AI feedback',
                  'Video & audio analysis',
                  'Coding interview mode',
                  'Priority support',
                  'Downloadable reports'
                ],
                cta: 'Start Free Trial',
                popular: true
              },
              {
                name: 'Enterprise',
                price: '$99',
                period: 'per month',
                features: [
                  'Everything in Pro',
                  'Custom AI training',
                  'Team management',
                  'API access',
                  'Dedicated support',
                  'Custom integrations'
                ],
                cta: 'Contact Sales',
                popular: false
              }
            ].map((plan, index) => (
              <Card
  key={index}
  className={`relative ${plan.popular ? 'ring-2 ring-primary' : ''} 
  p-6 text-center flex flex-col h-full`}
>
  {plan.popular && (
    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
      <span className="px-4 py-1 bg-primary text-white text-sm font-semibold rounded-full shadow-md">
        Most Popular
      </span>
    </div>
  )}

  <div className="mb-6">
    <h3 className="text-2xl font-semibold mb-2">{plan.name}</h3>

    <div className="flex items-baseline justify-center gap-2">
      <span className="text-5xl font-bold text-primary">{plan.price}</span>
      <span className="text-muted-foreground">/{plan.period}</span>
    </div>
  </div>

  <ul className="space-y-3 mb-8 text-left flex-1">
    {plan.features.map((feature, i) => (
      <li key={i} className="flex items-center gap-2">
        <Check className="w-5 h-5 text-green-500 shrink-0" />
        <span className="text-muted-foreground">{feature}</span>
      </li>
    ))}
  </ul>

  <div className="mt-auto">
    <Link to="/signup">
      <Button
        variant={'outline'}
        className="w-full"
      >
        {plan.cta}
      </Button>
    </Link>
  </div>
</Card>

            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <Card className="text-center bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-primary p-6">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Ready to Ace Your Next Interview?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Join thousands of successful candidates who improved their interview skills with AI
            </p>
            <Link to="/signup">
              <Button variant="primary" size="lg">
                Start Your Free Interview
                <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-primary rounded-lg">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-semibold text-foreground">Smart Interview AI</span>
              </div>
              <p className="text-muted-foreground text-sm">
                AI-powered interview preparation platform
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-primary">Features</a></li>
                <li><a href="#pricing" className="hover:text-primary">Pricing</a></li>
                <li><a href="#" className="hover:text-primary">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary">About</a></li>
                <li><a href="#" className="hover:text-primary">Blog</a></li>
                <li><a href="#" className="hover:text-primary">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary">Privacy</a></li>
                <li><a href="#" className="hover:text-primary">Terms</a></li>
                <li><a href="#" className="hover:text-primary">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 text-center text-sm text-muted-foreground">
            <p>© 2026 Smart Interview AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
