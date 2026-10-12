import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Copy,
  Check,
  Download,
  Share2,
  MessageCircle,
  Instagram,
  Sparkles,
  ExternalLink,
  Layers,
  Smartphone,
  FileText,
  RefreshCw,
  Image as ImageIcon,
  Eye,
  EyeOff,
  Clipboard,
  Info,
  Send,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import krishnaChariotSquare from "/krishna_arjuna_chariot.jpg";
import krishnaStoryVertical from "/krishna_arjuna_chariot.jpg";

export interface SocialShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawText: string;
  sourceTitle?: string;
  initialPlatform?: "whatsapp" | "instagram" | "card" | "twitter";
}

export interface ParsedWisdom {
  hook: string;
  verse: string;
  verseRef: string;
  essence: string;
  cardSummary: string; // Optimal balanced summary for picture cards (approx 30-50 words)
  fullSummary: string;
  takeaway: string;
  takeawayPoints: string[];
  engagementQuestion: string;
  raw: string;
}

// Intelligent extractor that extracts verses, complete summary, essence, and all practical takeaways
export function parseWisdomForSocial(rawText: string): ParsedWisdom {
  const cleanText = rawText.trim();

  // 1. Extract verse reference like BG 2.47 or Chapter 2, Verse 47
  const verseRefMatch = cleanText.match(/(?:BG|Bhagavad Gita|Gita|Chapter|Adhyay|Verse|Shloka)?\s*(\d{1,2}\s*[:.]\s*\d{1,2})/i);
  let verseRef = verseRefMatch ? `Bhagavad Gita ${verseRefMatch[1].replace(':', '.')}` : "Bhagavad Gita Wisdom";

  const chapterVerseMatch = cleanText.match(/(?:Chapter\s*(\d+)[,\s]+Verse\s*(\d+))/i);
  if (chapterVerseMatch) {
    verseRef = `Bhagavad Gita ${chapterVerseMatch[1]}.${chapterVerseMatch[2]}`;
  }

  // 2. Look for verse Sanskrit or transliterated / translated snippet
  let verseSnippet = "";
  const verseSectionMatch = cleanText.match(/(?:###|\*\*|#)?\s*(?:Relevant\s*Gita\s*verse|Relevant\s*verse|Gita\s*verse|Verse|Shloka)[^\n:]*[:\n]+([\s\S]*?)(?=(?:###|\*\*|#[^#]|$))/i);
  if (verseSectionMatch) {
    verseSnippet = verseSectionMatch[1]
      .replace(/[*\-_#]/g, '')
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 5 && !s.toLowerCase().startsWith('chapter') && !s.toLowerCase().startsWith('verse'))
      .join(' ')
      .trim();
  } else {
    // Check if there are quoted lines
    const quoteMatch = cleanText.match(/["“]([^"”]{20,280})["”]/);
    if (quoteMatch) {
      verseSnippet = quoteMatch[1].trim();
    }
  }

  // 3. Extract Practical Steps / Takeaways / Daily Dharma (all points, not just one)
  let takeawayPoints: string[] = [];
  const practicalMatch = cleanText.match(
    /(?:###|\*\*|#)?\s*(?:Practical\s*Actions?(?:\s*(?:&|and)\s*Daily\s*Dharma)?|Daily\s*Dharma(?:\s*Practice)?|Practical\s*(?:Actions?|Steps?|Application|Takeaways?)|Actionable\s*(?:Steps?|Guidance|Points?)|Daily\s*Practice|Action\s*Points?|Reflections?)[^\n:]*[:\n]+([\s\S]*?)(?=(?:###|\*\*|#[^#]|$))/i
  );
  if (practicalMatch) {
    const rawLines = practicalMatch[1].split('\n');
    for (const line of rawLines) {
      const cleaned = line.replace(/^[#*\-•\d.)\s]+/, '').replace(/[*\-_]/g, '').trim();
      if (cleaned.length > 6 && !cleaned.toLowerCase().startsWith('chapter') && !cleaned.toLowerCase().startsWith('verse')) {
        takeawayPoints.push(cleaned);
      }
    }
  }

  // If no explicit section, look for bullet points or numbered lists in the raw text
  if (takeawayPoints.length === 0) {
    const bulletMatches = cleanText.match(/(?:^|\n)\s*(?:[-•*]|\d+[.)])\s+([^\n]+)/g);
    if (bulletMatches && bulletMatches.length > 0) {
      takeawayPoints = bulletMatches
        .map(b => b.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, '').replace(/[*\-_]/g, '').trim())
        .filter(b => b.length > 8 && !b.toLowerCase().startsWith('chapter') && !b.toLowerCase().startsWith('verse'));
    }
  }

  // Fallback practical points if none detected
  if (takeawayPoints.length === 0) {
    takeawayPoints = [
      "Perform your daily duties wholeheartedly with devotion, releasing anxiety over outcomes.",
      "Cultivate inner stillness and steady equanimity amidst both success and failure.",
      "Surrender every action as a sacred offering to the Divine."
    ];
  }

  const takeaway = takeawayPoints.map((p, i) => `${i + 1}. ${p}`).join('\n');

  // 4. Extract Complete Wisdom Summary (Full Guidance, completely preserved)
  let fullSummary = "";
  const guidanceMatch = cleanText.match(
    /(?:###|\*\*|#)?\s*(?:Krishna’s\s*direct\s*guidance|Direct\s*guidance|Spiritual\s*Guidance(?:\s*(?:&|and)\s*Commentary)?|Guidance|Explanation|Divine\s*Teaching|Teaching|Wisdom)[^\n:]*[:\n]+([\s\S]*?)(?=(?:###|\*\*|#[^#]|$))/i
  );
  
  if (guidanceMatch) {
    const paragraphs = guidanceMatch[1]
      .split(/\n\n+/)
      .map(p => p.replace(/[#*`_]/g, '').trim())
      .filter(p => p.length > 15 && !p.startsWith('•') && !p.startsWith('-') && !/^\d+[.)]/.test(p));
    fullSummary = paragraphs.join("\n\n").trim();
  }

  // If guidance header was missing or yielded short text, extract from substantive paragraphs
  if (!fullSummary || fullSummary.length < 50) {
    const allParagraphs = cleanText
      .split(/\n\n+/)
      .map(p => p.replace(/[#*`_]/g, '').trim())
      .filter(p => {
        const lower = p.toLowerCase();
        if (lower.startsWith('###') || lower.startsWith('chapter') || lower.startsWith('relevant')) return false;
        if (lower.startsWith('peace be with you') && p.length < 90) return false;
        if (lower.startsWith('1.') || lower.startsWith('•') || lower.startsWith('-')) return false;
        return p.length > 25;
      });
    
    fullSummary = allParagraphs.join("\n\n").trim();
  }

  if (!fullSummary) {
    fullSummary = cleanText.replace(/[#*`_]/g, '').trim();
  }

  // 5. Card Summary (Balanced for social images: 1-2 impactful sentences, target 20-32 words)
  let cardSummary = "";
  const sentenceMatches = fullSummary
    .replace(/\n+/g, ' ')
    .match(/[^.!?]+[.!?]+/g)
    ?.map(s => s.trim())
    .filter(s => s.length > 12 && !s.toLowerCase().startsWith('chapter') && !s.toLowerCase().startsWith('verse')) || [];

  if (sentenceMatches.length > 0) {
    let combined = "";
    for (const s of sentenceMatches) {
      const candidate = combined ? `${combined} ${s}` : s;
      const wordCount = candidate.split(/\s+/).length;
      if (wordCount <= 32) {
        combined = candidate;
      } else {
        if (!combined) {
          if (wordCount <= 38) {
            combined = s;
          } else {
            const words = s.split(/\s+/).slice(0, 30);
            combined = `${words.join(' ')}...`;
          }
        }
        break;
      }
    }
    cardSummary = combined;
  }

  if (!cardSummary || cardSummary.length < 15) {
    const words = fullSummary.split(/\s+/).slice(0, 28);
    cardSummary = words.join(' ');
    if (!cardSummary.endsWith('.')) cardSummary += '.';
  }

  // 6. Essence (Single concise punchy mantra, 12-20 words)
  let essence = "";
  if (sentenceMatches.length > 0) {
    const s = sentenceMatches[0].trim();
    const words = s.split(/\s+/);
    if (words.length <= 22) {
      essence = s;
    } else {
      essence = `${words.slice(0, 20).join(' ')}...`;
    }
  } else {
    const words = cardSummary.split(/\s+/).slice(0, 18);
    essence = words.join(' ');
  }

  // Attention-grabbing hook
  const hookOptions = [
    "🌸 A Divine Reminder from Lord Krishna",
    "✨ Sacred Wisdom for Inner Peace & Clarity",
    "🕊️ When the Mind Feels Anxious or Confused",
    "🕉️ Bhagavad Gita: The Art of Fearless Living"
  ];
  const hook = hookOptions[Math.floor(Math.random() * hookOptions.length)];
  const engagementQuestion = "🙏 Type 'Radhe Radhe' or save this to revisit when your thoughts feel scattered.";

  return {
    hook,
    verse: verseSnippet,
    verseRef,
    essence: essence.trim(),
    cardSummary: cardSummary.trim(),
    fullSummary: fullSummary.trim(),
    takeaway: takeaway.trim(),
    takeawayPoints,
    engagementQuestion,
    raw: cleanText
  };
}

export const SocialShareModal: React.FC<SocialShareModalProps> = ({
  isOpen,
  onClose,
  rawText,
  sourceTitle = "Bhagavad Gita Wisdom",
  initialPlatform = "card"
}) => {
  const [activePlatform, setActivePlatform] = useState<"whatsapp" | "instagram" | "card" | "twitter">(initialPlatform);
  const [whatsAppMode, setWhatsAppMode] = useState<"image" | "text">("image");
  const [summaryMode, setSummaryMode] = useState<"balanced" | "concise" | "full">("balanced");
  const [isConcise, setIsConcise] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [imageCopied, setImageCopied] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<{
    title: string;
    description: string;
    type: "success" | "info";
  } | null>(null);
  const [cardTheme, setCardTheme] = useState<"krishna_art" | "saffron" | "twilight" | "parchment">("krishna_art");
  const [cardFormat, setCardFormat] = useState<"square" | "story">("square"); // square = 1080x1080, story = 1080x1920
  const [showTextOverlay, setShowTextOverlay] = useState<boolean>(true);
  const [parsed, setParsed] = useState<ParsedWisdom>(() => parseWisdomForSocial(rawText));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync initialPlatform whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      if (initialPlatform) {
        setActivePlatform(initialPlatform);
        if (initialPlatform === "instagram") {
          setCardFormat("story");
        } else if (initialPlatform === "whatsapp") {
          setCardFormat("square");
        }
      }
    }
  }, [isOpen, initialPlatform]);

  const squareImgRef = useRef<HTMLImageElement | null>(null);
  const storyImgRef = useRef<HTMLImageElement | null>(null);
  const [imagesReady, setImagesReady] = useState<boolean>(false);

  useEffect(() => {
    let count = 0;
    const onLoadOne = () => {
      count++;
      if (count >= 2) {
        setImagesReady(true);
      }
    };

    const img1 = new Image();
    img1.src = krishnaChariotSquare;
    img1.onload = () => {
      squareImgRef.current = img1;
      onLoadOne();
    };
    img1.onerror = () => onLoadOne();

    const img2 = new Image();
    img2.src = krishnaStoryVertical;
    img2.onload = () => {
      storyImgRef.current = img2;
      onLoadOne();
    };
    img2.onerror = () => onLoadOne();
  }, []);

  useEffect(() => {
    if (rawText) {
      setParsed(parseWisdomForSocial(rawText));
    }
  }, [rawText]);

  // Get effective wisdom text based on summaryMode
  const getWisdomForShare = () => {
    if (summaryMode === "concise") return parsed.essence;
    if (summaryMode === "full") return parsed.fullSummary || parsed.cardSummary || parsed.essence;
    return parsed.cardSummary || parsed.essence;
  };

  // Get effective practical points
  const getPointsForShare = () => {
    const list = (parsed.takeawayPoints && parsed.takeawayPoints.length > 0)
      ? parsed.takeawayPoints
      : (parsed.takeaway ? parsed.takeaway.split("\n").filter(l => l.trim().length > 0) : []);
    if (list.length === 0) {
      return [
        "Perform your daily duties wholeheartedly with devotion, releasing anxiety over outcomes.",
        "Cultivate inner stillness and steady equanimity amidst both success and failure.",
        "Surrender every action as a sacred offering to the Divine."
      ];
    }
    if (summaryMode === "concise") return list.slice(0, 2);
    return list;
  };

  // Construct text for WhatsApp following best practices
  const getWhatsAppText = () => {
    const wisdomText = getWisdomForShare();
    const points = getPointsForShare();
    const practicalBullets = points.map((p) => `• ${p.replace(/^[#*\-•\d.)\s]+/, "").trim()}`).join("\n");

    const headerTitle = summaryMode === "full"
      ? "Complete Wisdom Guidance"
      : summaryMode === "concise"
      ? "Core Mantra"
      : "Essence Wisdom";

    const parts = [
      `*${parsed.hook}* 🌸`,
      ``,
      `📜 _${parsed.verseRef}_`,
      parsed.verse ? `> _"${parsed.verse}"_` : null,
      ``,
      `💡 *${headerTitle}:*`,
      `${wisdomText}`,
      ``,
      `🕊️ *Practical Action & Daily Dharma:*`,
      `${practicalBullets}`,
      ``,
      `🙏 _May this wisdom bring serenity and steady focus to your path._`,
      `— *Bhagavad Gita`
    ].filter(Boolean);
    return parts.join("\n");
  };

  // Construct text for Instagram following best practices (Hook + Line Spacing + CTA + Hashtags)
  const getInstagramText = () => {
    const wisdomText = getWisdomForShare();
    const points = getPointsForShare();
    const practicalBullets = points.map(p => `👉 ${p.replace(/^[#*\-•\d.)\s]+/, "").trim()}`).join("\n");

    return [
      `${parsed.hook} ✨`,
      `.`,
      `📜 ${parsed.verseRef}`,
      parsed.verse ? `"${parsed.verse}"` : null,
      `.`,
      `“${wisdomText}”`,
      `.`,
      `🌿 Practical Action & Daily Dharma:`,
      `${practicalBullets}`,
      `.`,
      `${parsed.engagementQuestion}`,
      `.`,
      `.`,
      `#BhagavadGita #GitaWisdom #LordKrishna #KrishnaQuotes #SanatanaDharma #SpiritualGrowth #Mindfulness #InnerPeace #Dharma #DailyWisdom #MentalClarity #Meditation #SelfRealization #PeaceOfMind`
    ].filter(Boolean).join("\n");
  };

  // Construct text for X (Twitter) guaranteed under 280 characters
  const getTwitterText = () => {
    const baseText = `🌸 ${parsed.essence}\n\n— ${parsed.verseRef}\n\n#BhagavadGita #Wisdom`;
    if (baseText.length > 275) {
      const availableLen = 270 - (parsed.verseRef.length + 35);
      return `🌸 "${parsed.essence.slice(0, availableLen)}..."\n\n— ${parsed.verseRef}\n#BhagavadGita`;
    }
    return baseText;
  };

  const currentText = activePlatform === "whatsapp" 
    ? getWhatsAppText() 
    : activePlatform === "instagram" 
    ? getInstagramText() 
    : getTwitterText();

  // Helper to wrap text paragraphs into lines
  const wrapParagraphs = (
    c: CanvasRenderingContext2D,
    text: string,
    maxW: number
  ): string[][] => {
    const rawParagraphs = text.split(/\n+/).map(p => p.trim()).filter(Boolean);
    const paragraphs: string[][] = [];
    for (const para of rawParagraphs) {
      const words = para.split(/\s+/).filter(Boolean);
      const lines: string[] = [];
      let current = "";
      for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (c.measureText(test).width > maxW && current) {
          lines.push(current);
          current = word;
        } else {
          current = test;
        }
      }
      if (current) lines.push(current);
      if (lines.length > 0) paragraphs.push(lines);
    }
    return paragraphs;
  };

  // Render Canvas Quote Card with Complete Summary & Full Actionable Points
  const drawCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = 1080;
    const height = cardFormat === "story" ? 1920 : 1080;
    canvas.width = width;
    canvas.height = height;

    // Reset shadow
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // 1. Theme backgrounds
    if (cardTheme === "krishna_art") {
      const bgImg = cardFormat === "story" ? storyImgRef.current : squareImgRef.current;
      if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
        ctx.drawImage(bgImg, 0, 0, width, height);

        if (showTextOverlay) {
          // Atmospheric dark golden/midnight gradient scrim for supreme contrast & legibility
          const scrim = ctx.createLinearGradient(0, 0, 0, height);
          scrim.addColorStop(0, "rgba(8, 12, 22, 0.78)");
          scrim.addColorStop(0.25, "rgba(15, 23, 42, 0.52)");
          scrim.addColorStop(0.72, "rgba(15, 23, 42, 0.82)");
          scrim.addColorStop(1, "rgba(6, 10, 18, 0.96)");
          ctx.fillStyle = scrim;
          ctx.fillRect(0, 0, width, height);

          // Subtle warm radial center glow behind holy wisdom
          const rad = ctx.createRadialGradient(width / 2, height * 0.42, 60, width / 2, height * 0.42, 540);
          rad.addColorStop(0, "rgba(251, 191, 36, 0.16)");
          rad.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = rad;
          ctx.fillRect(0, 0, width, height);
        }
      } else {
        // Fallback gradient while loading
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, "#2a1506");
        grad.addColorStop(0.5, "#451a03");
        grad.addColorStop(1, "#1e1b4b");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }
    } else if (cardTheme === "saffron") {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#451a03"); // amber 950
      grad.addColorStop(0.4, "#78350f"); // amber 900
      grad.addColorStop(1, "#b45309"); // amber 700
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      const rad = ctx.createRadialGradient(width / 2, height / 3, 50, width / 2, height / 3, 600);
      rad.addColorStop(0, "rgba(251, 191, 36, 0.18)");
      rad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = rad;
      ctx.fillRect(0, 0, width, height);
    } else if (cardTheme === "twilight") {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#090d16");
      grad.addColorStop(0.5, "#172554");
      grad.addColorStop(1, "#1e1b4b");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      const rad = ctx.createRadialGradient(width / 2, height / 3, 50, width / 2, height / 3, 700);
      rad.addColorStop(0, "rgba(99, 102, 241, 0.22)");
      rad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = rad;
      ctx.fillRect(0, 0, width, height);
    } else {
      // Parchment / Clean Ivory
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#fffbeb");
      grad.addColorStop(0.7, "#fef3c7");
      grad.addColorStop(1, "#fde68a");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // In clean wallpaper mode, omit text overlay to leave pristine background art
    if (cardTheme === "krishna_art" && !showTextOverlay) {
      return;
    }

    const isLight = cardTheme === "parchment";

    // 2. Outer decorative borders
    ctx.strokeStyle = isLight ? "rgba(180, 83, 9, 0.25)" : "rgba(251, 191, 36, 0.45)";
    ctx.lineWidth = 4;
    ctx.strokeRect(48, 48, width - 96, height - 96);

    ctx.strokeStyle = isLight ? "rgba(180, 83, 9, 0.15)" : "rgba(251, 191, 36, 0.22)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(60, 60, width - 120, height - 120);

    // Corner decorative diamond marks
    const drawDiamond = (cx: number, cy: number, r: number) => {
      ctx.fillStyle = isLight ? "#92400e" : "#fbbf24";
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.fill();
    };
    drawDiamond(60, 60, 5);
    drawDiamond(width - 60, 60, 5);
    drawDiamond(60, height - 60, 5);
    drawDiamond(width - 60, height - 60, 5);

    // 3. Header Emblem & Title
    ctx.textAlign = "center";
    ctx.fillStyle = isLight ? "#92400e" : "#fde047";
    ctx.font = cardFormat === "story" ? "bold 26px serif" : "bold 23px serif";
    ctx.letterSpacing = "6px";
    
    const topY = cardFormat === "story" ? 180 : 100;
    ctx.fillText("ॐ  BHAGAVAD GITA  ॐ", width / 2, topY);

    // Subtitle / Verse Reference
    ctx.font = cardFormat === "story" ? "600 20px sans-serif" : "600 17px sans-serif";
    ctx.fillStyle = isLight ? "#78350f" : "#fef3c7";
    ctx.letterSpacing = "2px";
    ctx.fillText(parsed.verseRef.toUpperCase(), width / 2, topY + 36);

    // Decorative divider line with center diamond
    ctx.strokeStyle = isLight ? "rgba(180, 83, 9, 0.3)" : "rgba(251, 191, 36, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 110, topY + 56);
    ctx.lineTo(width / 2 - 12, topY + 56);
    ctx.moveTo(width / 2 + 12, topY + 56);
    ctx.lineTo(width / 2 + 110, topY + 56);
    ctx.stroke();
    drawDiamond(width / 2, topY + 56, 4);

    let curY = topY + 80;

    // 4. Content Elements Calculation & Preparation
    // Determine the quote body text for the image based on summaryMode
    let bodyText = "";
    if (summaryMode === "concise") {
      bodyText = parsed.essence;
    } else if (summaryMode === "full") {
      bodyText = parsed.fullSummary || parsed.cardSummary || parsed.essence;
    } else {
      // Default: "balanced" (Optimal for Image Card - large readable text, 20-32 words, 2-3 lines)
      bodyText = parsed.cardSummary || parsed.essence;
    }

    // Determine the practical action takeaway for the card
    const displayActionPoints: string[] = [];
    if (parsed.takeawayPoints && parsed.takeawayPoints.length > 0) {
      displayActionPoints.push(...parsed.takeawayPoints.slice(0, 2));
    } else if (parsed.takeaway) {
      const split = parsed.takeaway.split("\n").filter(l => l.trim().length > 5);
      displayActionPoints.push(...split.slice(0, 2));
    }

    const maxContentWidth = width - (cardFormat === "story" ? 220 : 160);
    const topContentLimit = topY + (cardFormat === "story" ? 90 : 75);
    const footerY = height - (cardFormat === "story" ? 70 : 50);
    const bottomContentLimit = footerY - (cardFormat === "story" ? 45 : 35);
    const availableHeight = bottomContentLimit - topContentLimit;

    // A. Sacred Verse Snippet (if available)
    let verseLines: string[] = [];
    const verseLineH = cardFormat === "story" ? 30 : 24;
    let verseH = 0;
    if (parsed.verse && parsed.verse.trim().length > 4) {
      ctx.font = cardFormat === "story" ? "italic 22px serif" : "italic 18px serif";
      const verseParas = wrapParagraphs(ctx, `“${parsed.verse.trim()}”`, maxContentWidth - 40);
      verseLines = verseParas.flat().slice(0, 2);
      verseH = verseLines.length * verseLineH + (cardFormat === "story" ? 24 : 16);
    }

    // B. Hero Wisdom Quote Font Scaling & Wrapping
    let quoteFontSize = cardFormat === "story"
      ? (summaryMode === "concise" ? 46 : summaryMode === "balanced" ? 40 : 30)
      : (summaryMode === "concise" ? 38 : summaryMode === "balanced" ? 33 : 24);

    let quoteLineH = Math.round(quoteFontSize * 1.52);
    const minQuoteFontSize = summaryMode === "concise" ? 30 : summaryMode === "balanced" ? 24 : 16;

    ctx.font = `normal ${quoteFontSize}px serif`;
    let quoteParas = wrapParagraphs(ctx, `“${bodyText}”`, maxContentWidth);
    let quoteLines = quoteParas.flat();

    // C. Practical Action & Daily Dharma Capsule Preparation
    let actionLines: string[] = [];
    let capsuleH = 0;
    const capsuleWidth = Math.min(840, maxContentWidth);
    const capsuleInnerW = capsuleWidth - 56;
    const actionLineH = cardFormat === "story" ? 24 : 20;

    if (displayActionPoints.length > 0) {
      ctx.font = cardFormat === "story" ? "500 17px sans-serif" : "500 14px sans-serif";
      for (const pt of displayActionPoints) {
        const cleanPt = pt.replace(/^[#*\-•\d.)\s]+/, "").trim();
        const prefix = displayActionPoints.length > 1 ? "• " : "";
        const aParas = wrapParagraphs(ctx, `${prefix}${cleanPt}`, capsuleInnerW);
        const ptLines = aParas.flat();
        if (ptLines.length > 0) {
          actionLines.push(...ptLines.slice(0, 2));
        }
      }
      if (actionLines.length > 3) {
        actionLines = actionLines.slice(0, 3);
      }
      capsuleH = (cardFormat === "story" ? 38 : 32) + actionLines.length * actionLineH + (cardFormat === "story" ? 18 : 14);
    }

    const capsuleGap = capsuleH > 0 ? (cardFormat === "story" ? 34 : 22) : 0;
    let totalContentH = verseH + quoteLines.length * quoteLineH + capsuleGap + capsuleH;

    // Gracefully scale down quote font if it exceeds available space
    while (quoteFontSize > minQuoteFontSize && totalContentH > availableHeight - 30) {
      quoteFontSize -= 1;
      quoteLineH = Math.round(quoteFontSize * 1.50);
      ctx.font = `normal ${quoteFontSize}px serif`;
      quoteParas = wrapParagraphs(ctx, `“${bodyText}”`, maxContentWidth);
      quoteLines = quoteParas.flat();
      totalContentH = verseH + quoteLines.length * quoteLineH + capsuleGap + capsuleH;
    }

    // 5. Optical Vertical Centering
    const freeSpace = availableHeight - totalContentH;
    curY = topContentLimit + Math.max(16, Math.round(freeSpace / 2));

    // Render Sacred Verse Snippet
    if (verseLines.length > 0) {
      ctx.textAlign = "center";
      ctx.font = cardFormat === "story" ? "italic 22px serif" : "italic 18px serif";
      ctx.fillStyle = isLight ? "rgba(120, 53, 15, 0.95)" : "rgba(254, 240, 138, 0.95)";
      for (const vLine of verseLines) {
        ctx.fillText(vLine, width / 2, curY);
        curY += verseLineH;
      }
      curY += cardFormat === "story" ? 24 : 16;
    }

    // Render Hero Wisdom Quote
    if (!isLight) {
      ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 2;
    }
    ctx.textAlign = "center";
    ctx.fillStyle = isLight ? "#0f172a" : "#ffffff";
    ctx.font = `normal ${quoteFontSize}px serif`;
    ctx.letterSpacing = "0.3px";

    for (const qLine of quoteLines) {
      ctx.fillText(qLine, width / 2, curY + Math.round(quoteFontSize * 0.8));
      curY += quoteLineH;
    }

    // Reset shadow
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Render Daily Dharma Action Capsule
    if (capsuleH > 0 && actionLines.length > 0) {
      curY += capsuleGap;
      const boxX = width / 2 - capsuleWidth / 2;
      const boxY = curY;

      // Frosted capsule background
      ctx.fillStyle = isLight ? "rgba(255, 255, 255, 0.86)" : "rgba(15, 23, 42, 0.85)";
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, capsuleWidth, capsuleH, 20);
      ctx.fill();

      // Capsule border
      ctx.strokeStyle = isLight ? "rgba(180, 83, 9, 0.35)" : "rgba(251, 191, 36, 0.45)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Capsule Tag
      ctx.fillStyle = isLight ? "#92400e" : "#fbbf24";
      ctx.font = cardFormat === "story" ? "bold 14px sans-serif" : "bold 12px sans-serif";
      ctx.letterSpacing = "2px";
      ctx.textAlign = "center";
      const tagY = boxY + (cardFormat === "story" ? 24 : 20);
      ctx.fillText("🌿 PRACTICAL ACTION & DAILY DHARMA", width / 2, tagY);

      // Capsule Action Text
      ctx.fillStyle = isLight ? "#1e293b" : "#f8fafc";
      ctx.font = cardFormat === "story" ? "500 17px sans-serif" : "500 14px sans-serif";
      ctx.letterSpacing = "0.2px";
      let aY = tagY + (cardFormat === "story" ? 24 : 20);
      for (const aLine of actionLines) {
        ctx.fillText(aLine, width / 2, aY);
        aY += actionLineH;
      }
    }

    // 6. Footer Divider & Attribution
    ctx.textAlign = "center";
    ctx.strokeStyle = isLight ? "rgba(180, 83, 9, 0.25)" : "rgba(251, 191, 36, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 100, footerY - 22);
    ctx.lineTo(width / 2 - 10, footerY - 22);
    ctx.moveTo(width / 2 + 10, footerY - 22);
    ctx.lineTo(width / 2 + 100, footerY - 22);
    ctx.stroke();
    drawDiamond(width / 2, footerY - 22, 3.5);

    ctx.fillStyle = isLight ? "#78350f" : "#fde68a";
    ctx.font = cardFormat === "story" ? "italic 19px serif" : "italic 16px serif";
    ctx.fillText("Sri Krishna's Guidance • Bhagavad Gita AI", width / 2, footerY);
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(drawCard, 60);
    }
  }, [isOpen, cardTheme, cardFormat, showTextOverlay, imagesReady, parsed, activePlatform, summaryMode, isConcise]);

  const copyImageToClipboard = async (): Promise<boolean> => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
      return false;
    }
    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          resolve(false);
          return;
        }
        try {
          const item = new ClipboardItem({ "image/png": blob });
          await navigator.clipboard.write([item]);
          resolve(true);
        } catch (err) {
          console.warn("ClipboardItem write failed:", err);
          resolve(false);
        }
      }, "image/png");
    });
  };

  const shareImageNatively = async (title: string, text: string): Promise<boolean> => {
    const canvas = canvasRef.current;
    if (!canvas || !navigator.share) return false;

    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          resolve(false);
          return;
        }
        try {
          const filename = cardFormat === "story" ? "krishna-gita-story.png" : "krishna-gita-card.png";
          const file = new File([blob], filename, { type: "image/png" });

          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title,
              text,
              files: [file]
            });
            resolve(true);
            return;
          } else {
            await navigator.share({
              title,
              text
            });
            resolve(true);
            return;
          }
        } catch (e: any) {
          if (e.name !== "AbortError") {
            console.warn("Native share failed:", e);
          }
          resolve(false);
        }
      }, "image/png");
    });
  };

  const triggerNotice = (title: string, description: string, type: "success" | "info" = "success") => {
    setActionNotice({ title, description, type });
    setTimeout(() => {
      setActionNotice((curr) => (curr?.title === title ? null : curr));
    }, 6500);
  };

  const handleShareToWhatsApp = async (shareImage: boolean = true) => {
    const text = getWhatsAppText();

    if (!shareImage) {
      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    const canvas = canvasRef.current;
    // On supported mobile devices, native share can send the image directly to WhatsApp
    if (canvas && navigator.share && navigator.canShare) {
      const shared = await shareImageNatively(parsed.hook, text);
      if (shared) {
        triggerNotice("Shared to WhatsApp!", "Your visual card and caption have been sent to WhatsApp.");
        return;
      }
    }

    // Desktop / Web flow:
    // 1. Copy image to clipboard so user can press Ctrl+V directly into WhatsApp chat
    const imgCopied = await copyImageToClipboard();
    // 2. Download the card file as well
    handleDownloadCard();
    // 3. Open WhatsApp Web or mobile app
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const waUrl = isMobile
      ? `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
      : `https://web.whatsapp.com`;
    window.open(waUrl, "_blank", "noopener,noreferrer");

    if (imgCopied) {
      triggerNotice(
        "Image Copied & WhatsApp Opened!",
        "The sacred image card is copied to your clipboard! Press Ctrl+V (Paste) in your WhatsApp chat to send the image card directly."
      );
    } else {
      triggerNotice(
        "Image Saved & WhatsApp Opened!",
        "The image card has been downloaded. Simply drag or attach it into your WhatsApp chat!"
      );
    }
  };

  const handleShareToInstagram = async () => {
    const text = getInstagramText();
    const canvas = canvasRef.current;

    // Check if native file share is supported (Mobile Safari/Chrome)
    if (canvas && navigator.share && navigator.canShare) {
      const shared = await shareImageNatively(parsed.hook, text);
      if (shared) {
        triggerNotice("Opening Instagram!", "Share sheet opened. Select Instagram Story, Feed, or Direct.");
        return;
      }
    }

    // Web / Desktop flow:
    // 1. Copy caption with hashtags to clipboard
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      console.warn("Could not copy caption", e);
    }

    // 2. Copy image to clipboard as well
    await copyImageToClipboard();

    // 3. Download the formatted image card (9:16 Story or 1:1 Feed)
    handleDownloadCard();

    // 4. Open Instagram
    window.open("https://www.instagram.com", "_blank", "noopener,noreferrer");

    triggerNotice(
      "Image Downloaded & Caption Copied!",
      "Opening Instagram! Click '+' Create to select the downloaded image, then paste your ready-to-post caption."
    );
  };

  const handleCopyImageOnly = async () => {
    const success = await copyImageToClipboard();
    if (success) {
      setImageCopied(true);
      triggerNotice(
        "Image Copied to Clipboard!",
        "Press Ctrl+V / Cmd+V in WhatsApp, Instagram, or any chat to paste the image."
      );
      setTimeout(() => setImageCopied(false), 3000);
    } else {
      handleDownloadCard();
      triggerNotice("Image Downloaded!", "Your browser saved the image card to your Downloads folder.");
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(currentText);
      setCopied(true);
      triggerNotice("Text Copied!", "Caption copied to clipboard and ready to paste.");
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const handleDownloadCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    const label = !showTextOverlay && cardTheme === "krishna_art" ? "krishna-wallpaper" : "gita-wisdom";
    link.download = `${label}-${cardFormat}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  const handleDownloadCleanBackground = () => {
    const link = document.createElement("a");
    const src = cardFormat === "story" ? krishnaStoryVertical : krishnaChariotSquare;
    link.download = `krishna-arjuna-background-${cardFormat}-${Date.now()}.jpg`;
    link.href = src;
    link.click();
  };

  const handleShareNative = async () => {
    const canvas = canvasRef.current;
    if (canvas && navigator.share && navigator.canShare) {
      try {
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          const file = new File([blob], "gita-wisdom.png", { type: "image/png" });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: parsed.hook,
              text: currentText,
              files: [file]
            });
            return;
          }
          await navigator.share({
            title: parsed.hook,
            text: currentText
          });
        });
        return;
      } catch (e) {
        console.log("Share failed or was canceled", e);
      }
    }

    // Fallback: copy text
    handleCopyText();
  };

  const handleOpenWhatsApp = () => {
    handleShareToWhatsApp(whatsAppMode === "image");
  };

  const handleOpenTwitter = () => {
    const text = getTwitterText();
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto"
        >
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-50/60 via-white to-indigo-50/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Social Media Wisdom Studio</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200/60">
                    Image & Text Sharing
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  Share beautiful visual cards with Lord Krishna artwork & captions to WhatsApp & Instagram
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action Notification Banner */}
          <AnimatePresence>
            {actionNotice && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border-b border-emerald-200/80 px-6 py-3 flex items-start justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <Check className="w-3 h-3" />
                  </div>
                  <div>
                    <p className="font-bold text-emerald-950">{actionNotice.title}</p>
                    <p className="text-emerald-800 leading-snug mt-0.5">{actionNotice.description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActionNotice(null)}
                  className="text-emerald-600 hover:text-emerald-900 p-1 rounded-md cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Modal Body: Two Column Studio */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Controls & Preview (Col 1-7) */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              {/* Platform Selector Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/70">
                <button
                  type="button"
                  onClick={() => setActivePlatform("whatsapp")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activePlatform === "whatsapp"
                      ? "bg-white text-emerald-700 shadow-sm border border-slate-200/50"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActivePlatform("instagram");
                    setCardFormat("story");
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activePlatform === "instagram"
                      ? "bg-white text-pink-700 shadow-sm border border-slate-200/50"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Instagram className="w-4 h-4 text-pink-600" />
                  <span>Instagram</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActivePlatform("card")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activePlatform === "card"
                      ? "bg-white text-amber-700 shadow-sm border border-slate-200/50"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Layers className="w-4 h-4 text-amber-600" />
                  <span>Visual Card</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActivePlatform("twitter")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activePlatform === "twitter"
                      ? "bg-white text-sky-700 shadow-sm border border-slate-200/50"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Share2 className="w-4 h-4 text-sky-600" />
                  <span>X / Tweet</span>
                </button>
              </div>

              {/* ----------------- WHATSAPP TAB ----------------- */}
              {activePlatform === "whatsapp" && (
                <div className="flex flex-col gap-4">
                  {/* Mode Toggle: Share Image Card vs Text Only */}
                  <div className="flex items-center gap-2 p-1.5 bg-emerald-50/80 rounded-2xl border border-emerald-200/70">
                    <button
                      type="button"
                      onClick={() => setWhatsAppMode("image")}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        whatsAppMode === "image"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "text-emerald-800 hover:bg-emerald-100/60"
                      }`}
                    >
                      <ImageIcon className="w-4 h-4" />
                      <span>Share Image Card (+ Caption)</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-700/80 text-white">Recommended</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setWhatsAppMode("text")}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        whatsAppMode === "text"
                          ? "bg-white text-slate-800 shadow-sm border border-slate-200"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Text Only</span>
                    </button>
                  </div>

                  {whatsAppMode === "image" ? (
                    <div className="flex flex-col gap-3">
                      {/* Image Layout & Theme Pickers */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1.5">WhatsApp Image Format</label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setCardFormat("square")}
                              className={`flex-1 py-2 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                                cardFormat === "square"
                                  ? "bg-emerald-800 text-emerald-50 border-emerald-700 shadow-xs"
                                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              1:1 Square (Chat / DP)
                            </button>
                            <button
                              type="button"
                              onClick={() => setCardFormat("story")}
                              className={`flex-1 py-2 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                                cardFormat === "story"
                                  ? "bg-emerald-800 text-emerald-50 border-emerald-700 shadow-xs"
                                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              9:16 Vertical (Status Story)
                            </button>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-bold text-slate-700">Aesthetic Theme</label>
                            {cardTheme === "krishna_art" && (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full">
                                Lord Krishna Art
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => setCardTheme("krishna_art")}
                              className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                cardTheme === "krishna_art"
                                  ? "bg-amber-900 text-amber-100 border-amber-500 shadow-xs"
                                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              <Sparkles className="w-3 h-3 text-amber-400" />
                              <span>Krishna Art</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setCardTheme("saffron")}
                              className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                                cardTheme === "saffron"
                                  ? "bg-amber-800 text-amber-100 border-amber-600 shadow-xs"
                                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              Saffron Glow
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Summary Density Selector on Image */}
                      <div className="bg-amber-50/70 rounded-2xl p-2.5 border border-amber-200/80 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                            <span>Content on Image:</span>
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900">
                            {summaryMode === "balanced" ? "Balanced & Readable (Recommended)" : summaryMode === "concise" ? "Short Quote" : "Full Guidance"}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSummaryMode("balanced")}
                            className={`py-1.5 px-1 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center text-center ${
                              summaryMode === "balanced"
                                ? "bg-amber-900 text-amber-100 border-amber-500 shadow-xs"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                            }`}
                            title="1–2 core sentences + 1 Daily Dharma step. Sized to fit comfortably and read clearly on phone screens."
                          >
                            <span className="leading-tight">✨ Balanced</span>
                            <span className="text-[9px] opacity-75 font-normal">Fits Image</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSummaryMode("concise")}
                            className={`py-1.5 px-1 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center text-center ${
                              summaryMode === "concise"
                                ? "bg-amber-900 text-amber-100 border-amber-500 shadow-xs"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                            }`}
                            title="1 core focus sentence for quick status updates."
                          >
                            <span className="leading-tight">🌸 Short</span>
                            <span className="text-[9px] opacity-75 font-normal">1 Mantra</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSummaryMode("full")}
                            className={`py-1.5 px-1 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center text-center ${
                              summaryMode === "full"
                                ? "bg-amber-900 text-amber-100 border-amber-500 shadow-xs"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                            }`}
                            title="Full extensive text."
                          >
                            <span className="leading-tight">📜 Full</span>
                            <span className="text-[9px] opacity-75 font-normal">All Text</span>
                          </button>
                        </div>
                      </div>

                      {/* Primary WhatsApp Action Buttons */}
                      <div className="flex flex-col gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleShareToWhatsApp(true)}
                          className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>Share Image to WhatsApp</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                        </button>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={handleCopyImageOnly}
                            className="py-2.5 px-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                          >
                            {imageCopied ? (
                              <>
                                <Check className="w-4 h-4 text-emerald-600" />
                                <span className="text-emerald-700">Image Copied!</span>
                              </>
                            ) : (
                              <>
                                <Clipboard className="w-4 h-4 text-slate-500" />
                                <span>Copy Image (Ctrl+V)</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={handleDownloadCard}
                            className="py-2.5 px-3 rounded-2xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                          >
                            <Download className="w-4 h-4 text-emerald-700" />
                            <span>Download Image</span>
                          </button>
                        </div>
                      </div>

                      {/* Caption Preview Accordion */}
                      <div className="mt-2 bg-slate-50 rounded-2xl p-3 border border-slate-200">
                        <div className="flex items-center justify-between pb-1.5">
                          <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            <span>WhatsApp Companion Caption</span>
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyText}
                            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                          >
                            {copied ? "Copied!" : "Copy Caption"}
                          </button>
                        </div>
                        <div className="p-2 rounded-xl bg-white border border-slate-200/80 text-[11px] text-slate-700 font-mono whitespace-pre-wrap max-h-[140px] overflow-y-auto leading-relaxed select-text">
                          {getWhatsAppText()}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Text only mode */
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between px-3.5 py-2.5 bg-amber-50/50 rounded-2xl border border-amber-200/60">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                          <p className="text-xs font-bold text-amber-950">
                            {isConcise ? "Concise High-Impact Text" : "Full Wisdom Text"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsConcise(!isConcise)}
                          className="text-xs font-bold px-3 py-1.5 rounded-xl border border-amber-300 bg-white text-amber-800 hover:bg-amber-100 transition-colors shadow-xs cursor-pointer"
                        >
                          {isConcise ? "Switch to Full" : "Switch to Concise"}
                        </button>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-mono leading-relaxed whitespace-pre-wrap overflow-y-auto max-h-[220px] shadow-inner select-text">
                        {getWhatsAppText()}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleShareToWhatsApp(false)}
                        className="w-full py-2.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>Send Text to WhatsApp</span>
                        <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ----------------- INSTAGRAM TAB ----------------- */}
              {activePlatform === "instagram" && (
                <div className="flex flex-col gap-3">
                  {/* Format & Theme Selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1.5">Instagram Image Ratio</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setCardFormat("story")}
                          className={`flex-1 py-2 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                            cardFormat === "story"
                              ? "bg-pink-700 text-white border-pink-700 shadow-xs"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          9:16 Story / Reel (Best)
                        </button>
                        <button
                          type="button"
                          onClick={() => setCardFormat("square")}
                          className={`flex-1 py-2 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                            cardFormat === "square"
                              ? "bg-pink-700 text-white border-pink-700 shadow-xs"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          1:1 Feed Post
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-700">Aesthetic Theme</label>
                        {cardTheme === "krishna_art" && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full">
                            Lord Krishna Art
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setCardTheme("krishna_art")}
                          className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                            cardTheme === "krishna_art"
                              ? "bg-amber-900 text-amber-100 border-amber-500 shadow-xs"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          <span>Krishna Art</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCardTheme("twilight")}
                          className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                            cardTheme === "twilight"
                              ? "bg-slate-900 text-indigo-100 border-indigo-500 shadow-xs"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          Twilight
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Summary Density Selector on Image */}
                  <div className="bg-pink-50/70 rounded-2xl p-2.5 border border-pink-200/80 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-pink-950 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-pink-600" />
                        <span>Content on Image:</span>
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-200/80 text-pink-900">
                        {summaryMode === "balanced" ? "Balanced & Readable (Recommended)" : summaryMode === "concise" ? "Short Quote" : "Full Guidance"}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSummaryMode("balanced")}
                        className={`py-1.5 px-1 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center text-center ${
                          summaryMode === "balanced"
                            ? "bg-pink-800 text-white border-pink-600 shadow-xs"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                        title="1–2 core sentences + 1 Daily Dharma step. Sized to fit comfortably and read clearly on phone screens."
                      >
                        <span className="leading-tight">✨ Balanced</span>
                        <span className="text-[9px] opacity-75 font-normal">Fits Image</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSummaryMode("concise")}
                        className={`py-1.5 px-1 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center text-center ${
                          summaryMode === "concise"
                            ? "bg-pink-800 text-white border-pink-600 shadow-xs"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                        title="1 core focus sentence for quick status updates."
                      >
                        <span className="leading-tight">🌸 Short</span>
                        <span className="text-[9px] opacity-75 font-normal">1 Mantra</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSummaryMode("full")}
                        className={`py-1.5 px-1 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center text-center ${
                          summaryMode === "full"
                            ? "bg-pink-800 text-white border-pink-600 shadow-xs"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                        title="Full extensive text."
                      >
                        <span className="leading-tight">📜 Full</span>
                        <span className="text-[9px] opacity-75 font-normal">All Text</span>
                      </button>
                    </div>
                  </div>

                  {/* Primary Instagram Action Buttons */}
                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleShareToInstagram}
                      className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 hover:opacity-95 text-white font-bold text-xs shadow-md shadow-pink-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                    >
                      <Instagram className="w-4 h-4" />
                      <span>Share Image to Instagram</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleCopyImageOnly}
                        className="py-2.5 px-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        {imageCopied ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-600" />
                            <span className="text-emerald-700">Image Copied!</span>
                          </>
                        ) : (
                          <>
                            <Clipboard className="w-4 h-4 text-slate-500" />
                            <span>Copy Image</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleCopyText}
                        className="py-2.5 px-3 rounded-2xl border border-pink-300 bg-pink-50 hover:bg-pink-100 text-pink-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        {copied ? (
                          <>
                            <Check className="w-4 h-4 text-pink-700" />
                            <span>Caption Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 text-pink-700" />
                            <span>Copy Caption</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Instagram Caption & Hashtags Preview */}
                  <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 mt-1">
                    <div className="flex items-center justify-between pb-1.5 text-xs text-slate-500 font-medium">
                      <span>Instagram Caption + Viral Hashtags</span>
                      <span className="text-[10px] font-bold text-pink-700 bg-pink-100 px-2 py-0.5 rounded-full">
                        Curated for Reach
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-slate-200 text-slate-800 text-[11px] font-mono leading-relaxed whitespace-pre-wrap overflow-y-auto max-h-[160px] shadow-inner select-text">
                      {getInstagramText()}
                    </div>
                  </div>
                </div>
              )}

              {/* ----------------- VISUAL CARD TAB ----------------- */}
              {activePlatform === "card" && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-700">Aesthetic Theme & Background</label>
                        {cardTheme === "krishna_art" && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full">
                            Lord Krishna & Arjuna Chariot
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <button
                          type="button"
                          onClick={() => setCardTheme("krishna_art")}
                          className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                            cardTheme === "krishna_art"
                              ? "bg-amber-900 text-amber-100 border-amber-500 shadow-sm ring-2 ring-amber-500/20"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          <span>Krishna Art</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCardTheme("saffron")}
                          className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            cardTheme === "saffron"
                              ? "bg-amber-800 text-amber-100 border-amber-600 shadow-sm"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          Saffron Glow
                        </button>
                        <button
                          type="button"
                          onClick={() => setCardTheme("twilight")}
                          className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            cardTheme === "twilight"
                              ? "bg-slate-900 text-indigo-100 border-indigo-500 shadow-sm"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          Twilight
                        </button>
                        <button
                          type="button"
                          onClick={() => setCardTheme("parchment")}
                          className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            cardTheme === "parchment"
                              ? "bg-amber-100 text-amber-900 border-amber-300 shadow-sm"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          Parchment
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1.5">Canvas Ratio</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setCardFormat("square")}
                            className={`flex-1 py-2 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                              cardFormat === "square"
                                ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            1:1 Square (Feed/DP)
                          </button>
                          <button
                            type="button"
                            onClick={() => setCardFormat("story")}
                            className={`flex-1 py-2 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                              cardFormat === "story"
                                ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            9:16 Story / Status
                          </button>
                        </div>
                      </div>

                      {cardTheme === "krishna_art" && (
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1.5">Image Content</label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setShowTextOverlay(true)}
                              className={`flex-1 py-2 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                showTextOverlay
                                  ? "bg-amber-800 text-amber-100 border-amber-600 shadow-xs"
                                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>With Text</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowTextOverlay(false)}
                              className={`flex-1 py-2 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                !showTextOverlay
                                  ? "bg-amber-800 text-amber-100 border-amber-600 shadow-xs"
                                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>Clean Art Only</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Content Density Selector */}
                  <div className="bg-amber-50/70 rounded-2xl p-2.5 border border-amber-200/80 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>Content on Image:</span>
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900">
                        {summaryMode === "balanced" ? "Balanced (Fits Image & Readable)" : summaryMode === "concise" ? "Short Quote" : "Full Guidance"}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSummaryMode("balanced")}
                        className={`py-1.5 px-1 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center text-center ${
                          summaryMode === "balanced"
                            ? "bg-amber-900 text-amber-100 border-amber-500 shadow-xs"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                        title="2-3 key sentences + 2 action steps. Sized to fit comfortably and read clearly on phone screens."
                      >
                        <span className="leading-tight">✨ Balanced</span>
                        <span className="text-[9px] opacity-75 font-normal">Fits Image</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSummaryMode("concise")}
                        className={`py-1.5 px-1 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center text-center ${
                          summaryMode === "concise"
                            ? "bg-amber-900 text-amber-100 border-amber-500 shadow-xs"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                        title="1 core focus sentence for quick status updates."
                      >
                        <span className="leading-tight">🌸 Short</span>
                        <span className="text-[9px] opacity-75 font-normal">1 Mantra</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSummaryMode("full")}
                        className={`py-1.5 px-1 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center text-center ${
                          summaryMode === "full"
                            ? "bg-amber-900 text-amber-100 border-amber-500 shadow-xs"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                        title="Full extensive text."
                      >
                        <span className="leading-tight">📜 Full</span>
                        <span className="text-[9px] opacity-75 font-normal">All Text</span>
                      </button>
                    </div>
                  </div>

                  {/* Wisdom Summary Text Area Editor */}
                  <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        {summaryMode === "balanced"
                          ? "Balanced Wisdom on Image (Fits Card)"
                          : summaryMode === "concise"
                          ? "Short Quote on Image"
                          : "Full Guidance Text on Image"}
                      </label>
                      <span className="text-[10px] text-slate-400">Renders live on card</span>
                    </div>
                    <textarea
                      value={
                        summaryMode === "balanced"
                          ? (parsed.cardSummary || parsed.essence)
                          : summaryMode === "concise"
                          ? parsed.essence
                          : (parsed.fullSummary || parsed.cardSummary || parsed.essence)
                      }
                      onChange={(e) => {
                        if (summaryMode === "balanced") {
                          setParsed({ ...parsed, cardSummary: e.target.value });
                        } else if (summaryMode === "concise") {
                          setParsed({ ...parsed, essence: e.target.value });
                        } else {
                          setParsed({ ...parsed, fullSummary: e.target.value });
                        }
                      }}
                      rows={summaryMode === "balanced" ? 3 : summaryMode === "concise" ? 2 : 5}
                      className="w-full text-xs p-2.5 rounded-xl bg-white border border-slate-200 focus:outline-amber-500 text-slate-800 leading-relaxed resize-y"
                      placeholder="Enter wisdom guidance summary..."
                    />
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>
                        {summaryMode === "balanced"
                          ? "💡 20–32 words (1–2 sentences) fits comfortably with large, readable typography."
                          : summaryMode === "concise"
                          ? "💡 1 punchy focus sentence rendered in large display font."
                          : "💡 Full text is dynamically scaled to fit within bounds."}
                      </span>
                    </div>
                  </div>

                  {/* Practical Action Steps Editor */}
                  <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        Practical Action & Daily Dharma (Card Capsule & Social Posts)
                      </label>
                      <span className="text-[10px] text-slate-400">1 action per line (appears in card capsule & captions)</span>
                    </div>
                    <textarea
                      value={(parsed.takeawayPoints && parsed.takeawayPoints.length > 0) ? parsed.takeawayPoints.join("\n") : parsed.takeaway}
                      onChange={(e) => {
                        const lines = e.target.value.split("\n").filter(l => l.trim().length > 0);
                        setParsed({
                          ...parsed,
                          takeawayPoints: lines,
                          takeaway: lines.join("\n")
                        });
                      }}
                      rows={3}
                      className="w-full text-xs p-2.5 rounded-xl bg-white border border-slate-200 focus:outline-amber-500 text-slate-800 leading-relaxed resize-y"
                      placeholder="Practical daily takeaways (one per line)..."
                    />
                  </div>

                  {/* Verse Reference & Verse Text */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-200">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Verse Reference
                      </label>
                      <input
                        type="text"
                        value={parsed.verseRef}
                        onChange={(e) => setParsed({ ...parsed, verseRef: e.target.value })}
                        className="w-full text-xs p-2 rounded-xl bg-white border border-slate-200 focus:outline-amber-500 text-slate-800"
                        placeholder="e.g. Bhagavad Gita 2.47"
                      />
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-200">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Sacred Verse / Shloka
                      </label>
                      <input
                        type="text"
                        value={parsed.verse}
                        onChange={(e) => setParsed({ ...parsed, verse: e.target.value })}
                        className="w-full text-xs p-2 rounded-xl bg-white border border-slate-200 focus:outline-amber-500 text-slate-800"
                        placeholder="Optional shloka..."
                      />
                    </div>
                  </div>

                  {/* Direct 1-Click Platform Actions */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleShareToWhatsApp(true)}
                      className="py-2.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Share to WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleShareToInstagram}
                      className="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 hover:opacity-95 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Instagram className="w-4 h-4" />
                      <span>Share to Instagram</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ----------------- TWITTER TAB ----------------- */}
              {activePlatform === "twitter" && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between pb-1 text-xs text-slate-500 font-medium">
                    <span>Tweet Preview ({currentText.length} characters)</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      currentText.length <= 280 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                    }`}>
                      {currentText.length}/280 chars
                    </span>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-mono leading-relaxed whitespace-pre-wrap overflow-y-auto max-h-[260px] shadow-inner select-text">
                    {currentText}
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenTwitter}
                    className="w-full py-2.5 px-4 rounded-2xl bg-slate-900 hover:bg-black text-white font-bold text-xs shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Share2 className="w-4 h-4 text-sky-400" />
                    <span>Post on X / Twitter</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                  </button>
                </div>
              )}
            </div>

            {/* Right Live Preview Column (Col 8-12) */}
            <div className="lg:col-span-5 flex flex-col items-center justify-between bg-slate-100/70 p-4 rounded-3xl border border-slate-200/70">
              <div className="w-full flex items-center justify-between pb-3">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    {cardTheme === "krishna_art" && !showTextOverlay
                      ? "Clean Krishna Background"
                      : "Image Card Preview"}
                  </span>
                </span>
                <div className="flex items-center gap-1.5">
                  {showTextOverlay && (
                    <button
                      type="button"
                      onClick={() => setSummaryMode(
                        summaryMode === "balanced"
                          ? "concise"
                          : summaryMode === "concise"
                          ? "full"
                          : "balanced"
                      )}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Click to cycle: Balanced (Fits Image) → Short Quote → Full Guidance"
                    >
                      <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                      <span>
                        {summaryMode === "balanced"
                          ? "✨ Balanced"
                          : summaryMode === "concise"
                          ? "🌸 Short"
                          : "📜 Full"}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={drawCard}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                    title="Refresh Card Render"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Canvas Preview Container */}
              <div className="w-full flex-1 flex items-center justify-center overflow-hidden py-2">
                <canvas
                  ref={canvasRef}
                  className="rounded-2xl shadow-xl border border-slate-300/60 max-w-full max-h-[300px] object-contain transition-all duration-300"
                />
              </div>

              {/* Card Quick Action Buttons */}
              <div className="w-full pt-4 flex flex-col gap-2">
                {/* 1-Click WhatsApp & Instagram buttons right below preview */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleShareToWhatsApp(true)}
                    className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShareToInstagram}
                    className="py-2 px-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:opacity-95 text-white font-bold text-[11px] shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Instagram className="w-3.5 h-3.5" />
                    <span>Instagram</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleCopyImageOnly}
                    className="py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Clipboard className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copy Image</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadCard}
                    className="py-2 px-3 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-700" />
                    <span>Download PNG</span>
                  </button>
                </div>

                {cardTheme === "krishna_art" && (
                  <button
                    type="button"
                    onClick={handleDownloadCleanBackground}
                    className="w-full py-1.5 px-3 rounded-xl text-slate-500 hover:text-amber-800 font-medium text-[10px] flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <ImageIcon className="w-3 h-3 text-amber-600" />
                    <span>Original Artwork ({cardFormat === "story" ? "9:16 Story" : "1:1 Square"})</span>
                  </button>
                )}

                <p className="text-[10px] text-center text-slate-400">
                  {cardFormat === "story"
                    ? "9:16 Vertical for WhatsApp Status & Instagram Stories"
                    : "1:1 Square for WhatsApp Profile & Instagram Posts"}
                </p>
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyText}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-xs cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copy Caption</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCopyImageOnly}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-xs cursor-pointer"
              >
                {imageCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Image Copied!</span>
                  </>
                ) : (
                  <>
                    <Clipboard className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copy Image</span>
                  </>
                )}
              </button>

              {typeof navigator !== "undefined" && navigator.share && (
                <button
                  type="button"
                  onClick={handleShareNative}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-xs cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Share...</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {activePlatform === "whatsapp" && (
                <button
                  type="button"
                  onClick={() => handleShareToWhatsApp(whatsAppMode === "image")}
                  className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>{whatsAppMode === "image" ? "Share Image to WhatsApp" : "Open WhatsApp"}</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </button>
              )}

              {activePlatform === "instagram" && (
                <button
                  type="button"
                  onClick={handleShareToInstagram}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 hover:opacity-95 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-pink-500/20 transition-all active:scale-95 cursor-pointer"
                >
                  <Instagram className="w-4 h-4" />
                  <span>Share Image to Instagram</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </button>
              )}

              {activePlatform === "twitter" && (
                <button
                  type="button"
                  onClick={handleOpenTwitter}
                  className="px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-black text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <Share2 className="w-4 h-4 text-sky-400" />
                  <span>Post on X</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </button>
              )}

              {activePlatform === "card" && (
                <button
                  type="button"
                  onClick={handleDownloadCard}
                  className="px-5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-amber-600/20 transition-all active:scale-95 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Image Card</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
