"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import ScrollReveal from "@/components/animations/ScrollReveal";
import AnimatedSquiggly from "@/components/animations/AnimatedSquiggly";
import { images } from "@/lib/images";
import { supabase } from "@/lib/supabase";

interface Event {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  date: string;
  end_date: string | null;
  image_url: string | null;
  is_active: boolean;
}

export default function EventsPage() {
  const [upcoming, setUpcoming] = useState<Event[]>([]);
  const [past, setPast] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    const now = new Date().toISOString();
    const [upRes, pastRes] = await Promise.all([
      supabase
        .from("events")
        .select("*")
        .eq("is_active", true)
        .gte("date", now)
        .order("date", { ascending: true }),
      supabase
        .from("events")
        .select("*")
        .lt("date", now)
        .order("date", { ascending: false })
        .limit(10),
    ]);

    if (upRes.data) setUpcoming(upRes.data);
    if (pastRes.data) setPast(pastRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const formatTime = (date: string, endDate?: string | null) => {
    const start = new Date(date).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    if (endDate) {
      const end = new Date(endDate).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
      return `${start} – ${end}`;
    }
    return start;
  };

  const getMonth = (date: string) =>
    new Date(date).toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const getDay = (date: string) => new Date(date).getDate();

  return (
    <>
      {/* ===== BRANDED TYPOGRAPHY HEADER ===== */}
      <section className="pt-16 pb-10 bg-gradient-warm relative overflow-hidden">
        <div className="absolute top-12 right-16 w-20 h-20 rounded-full bg-salmon/15 animate-float" />
        <div className="absolute bottom-8 left-10 w-14 h-14 rounded-full bg-golden/20 animate-float-reverse" />
        <div className="relative max-w-5xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <p className="stamp text-burgundy mb-6">Events</p>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h1 className="font-fun text-burgundy text-5xl md:text-7xl mb-4">
              Come get a <AnimatedSquiggly>bite</AnimatedSquiggly> in person.
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-body-lg text-dark/50 max-w-xl">
              Pop-ups, markets, gym partnerships, and tasting events. Follow us to never miss a drop.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ===== UPCOMING EVENTS ===== */}
      <section className="py-16 md:py-24 bg-cream">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <p className="stamp text-burgundy mb-8">Upcoming</p>
          </ScrollReveal>

          {loading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="card-bakery p-8 animate-pulse"
                >
                  <div className="h-6 w-48 bg-cream-dark rounded mb-3" />
                  <div className="h-4 w-32 bg-cream-dark rounded" />
                </div>
              ))}
            </div>
          ) : upcoming.length > 0 ? (
            <div className="space-y-6">
              {upcoming.map((event, i) => (
                <ScrollReveal key={event.id} delay={i * 0.1}>
                  <div className="card-bakery p-8 hover:shadow-lg transition-shadow group">
                    <div className="flex flex-col md:flex-row md:items-start gap-6">
                      {/* Date badge */}
                      <div className="shrink-0 bg-burgundy rounded-2xl p-4 text-center min-w-[90px] shadow-md">
                        <p className="text-salmon-light text-xs font-bold tracking-wider">
                          {getMonth(event.date)}
                        </p>
                        <p className="text-white text-3xl font-bold font-display">
                          {getDay(event.date)}
                        </p>
                      </div>

                      <div className="flex-1">
                        <h3 className="text-dark text-xl font-bold group-hover:text-burgundy transition-colors mb-2 font-display">
                          {event.title}
                        </h3>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-gray text-sm mb-3">
                          <span className="flex items-center gap-1.5">
                            <svg className="w-4 h-4 text-burgundy/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {formatTime(event.date, event.end_date)}
                          </span>
                          {event.location && (
                            <span className="flex items-center gap-1.5">
                              <svg className="w-4 h-4 text-burgundy/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {event.location}
                            </span>
                          )}
                        </div>
                        {event.description && (
                          <p className="text-gray leading-relaxed">{event.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          ) : (
            <ScrollReveal>
              <div className="card-bakery text-center py-16 px-8">
                <span className="text-5xl mb-4 block animate-bounce-gentle">🧁</span>
                <p className="text-dark font-bold text-lg mb-2 font-display">
                  No upcoming events right now.
                </p>
                <p className="text-gray text-sm">
                  Check back soon — we&apos;re always cooking something up.
                </p>
              </div>
            </ScrollReveal>
          )}
        </div>
      </section>

      {/* ===== PAST EVENTS ===== */}
      {past.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-5xl mx-auto px-6 lg:px-8">
            <ScrollReveal>
              <p className="text-gray text-xs uppercase tracking-[0.3em] font-bold mb-8">
                Past Events
              </p>
            </ScrollReveal>
            <div className="space-y-0">
              {past.map((event, i) => (
                <ScrollReveal key={event.id} delay={i * 0.05}>
                  <div className="flex items-center gap-6 py-4 border-b border-cream-dark/50">
                    <span className="text-burgundy/60 text-sm font-semibold w-32 shrink-0">
                      {formatDate(event.date)}
                    </span>
                    <span className="text-dark font-medium">{event.title}</span>
                    {event.location && (
                      <span className="text-gray text-sm ml-auto hidden sm:block">
                        {event.location}
                      </span>
                    )}
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== CTA ===== */}
      <section className="py-20 bg-gradient-warm relative overflow-hidden">
        <div className="absolute top-8 right-12 w-16 h-16 rounded-full bg-salmon/20 animate-float" />
        <div className="absolute bottom-12 left-16 w-12 h-12 rounded-full bg-golden/20 animate-float-reverse" />

        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <ScrollReveal>
            <div className="card-bakery overflow-hidden shadow-lg">
              <div className="relative h-44">
                <Image
                  src={images.allMuffins2}
                  alt="Bite Me muffins"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white" />
              </div>
              <div className="p-10 -mt-8 relative">
                <h3 className="text-section font-fun text-burgundy mb-4">
                  Want us at your gym or event?
                </h3>
                <p className="text-gray mb-8 max-w-md mx-auto">
                  We love pop-ups and partnerships. Let&apos;s make it happen.
                </p>
                <a
                  href="mailto:hello@bitemeprotein.com"
                  className="btn-primary inline-flex items-center justify-center"
                >
                  Get in Touch
                </a>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
