export interface Tool {
  id: string;
  name: string;
  description: string;
  icon: string;
  inputType: "code" | "image" | "text" | "url" | "design";
  placeholder: string;
  badge?: string;
  sample?: string;
}

export const TOOLS: Tool[] = [
  {
    id: "design-to-code",
    name: "Design to Code",
    description: "Drop a screenshot or paste a Figma URL → get a complete React + Tailwind component",
    icon: "🎨",
    inputType: "design",
    placeholder: "",
    badge: "New ✨",
  },
  {
    id: "screenshot",
    name: "Screenshot Analyzer",
    description: "Analyze UI screenshots for components, accessibility & improvements",
    icon: "🖼️",
    inputType: "image",
    placeholder: "Drop a UI screenshot here...",
    badge: "Vision AI",
  },
  {
    id: "component",
    name: "Component Generator",
    description: "Describe a component and get production-ready React + Tailwind code",
    icon: "⚛️",
    inputType: "text",
    placeholder: "e.g. A responsive pricing card with 3 tiers, highlight the middle one...",
    sample: "A responsive pricing card component with 3 tiers (Free, Pro, Enterprise). Highlight the Pro tier. Include feature lists, a CTA button, and a 'Most Popular' badge. Use a dark theme with violet accent colors.",
  },
  {
    id: "code-review",
    name: "AI Code Review",
    description: "Get a thorough review: bugs, security, performance & style",
    icon: "🔍",
    inputType: "code",
    placeholder: "Paste your React/TypeScript code here...",
    sample: `import { useState, useEffect } from 'react';

function UserDashboard({ userId }) {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    fetch('/api/users/' + userId)
      .then(r => r.json())
      .then(data => setUser(data));

    fetch('/api/posts?user=' + userId)
      .then(r => r.json())
      .then(data => setPosts(data));
  }, []);

  const deletePost = (id) => {
    fetch('/api/posts/' + id, { method: 'DELETE' });
    setPosts(posts.filter(p => p.id != id));
  };

  return (
    <div>
      <h1>Welcome {user.name}</h1>
      <div dangerouslySetInnerHTML={{ __html: user.bio }} />
      {posts.map((post, i) => (
        <div key={i}>
          <p>{post.title}</p>
          <button onClick={() => deletePost(post.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}`,
  },
  {
    id: "architecture",
    name: "Architecture Review",
    description: "Detect prop drilling, re-renders, coupling & get a refactoring roadmap",
    icon: "🏗️",
    inputType: "code",
    placeholder: "Paste your React component or file here...",
    sample: `// App.tsx
function App() {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('light');
  const [cart, setCart] = useState([]);
  const [notifications, setNotifications] = useState([]);

  return (
    <Header user={user} theme={theme} cart={cart} notifications={notifications} setTheme={setTheme} />
    <Main user={user} cart={cart} setCart={setCart} theme={theme} />
    <Footer user={user} theme={theme} />
  );
}

function Header({ user, theme, cart, notifications, setTheme }) {
  return (
    <nav>
      <Logo theme={theme} />
      <NavLinks user={user} theme={theme} />
      <CartIcon cart={cart} theme={theme} />
      <NotificationBell notifications={notifications} user={user} theme={theme} />
      <ThemeToggle theme={theme} setTheme={setTheme} />
    </nav>
  );
}

function CartIcon({ cart, theme }) {
  return <div className={theme}>{cart.length}</div>;
}`,
  },
  {
    id: "accessibility",
    name: "Accessibility Checker",
    description: "WCAG 2.1 audit: find and fix accessibility violations in your code",
    icon: "♿",
    inputType: "code",
    placeholder: "Paste your JSX/HTML code here...",
    sample: `function LoginForm() {
  return (
    <div style={{ background: '#ccc', color: '#ddd' }}>
      <div onclick="submitForm()">
        <img src="/logo.png" />
        <span style="font-size: 20px; font-weight: bold">Sign In</span>
      </div>
      <div>
        <span>Email</span>
        <input type="text" />
      </div>
      <div>
        <span>Password</span>
        <input type="text" />
      </div>
      <div style={{ background: '#aaa', color: '#bbb', padding: '8px' }}
           onclick="submitForm()">
        Login
      </div>
      <a href="#" style="color: #ccc">Forgot password?</a>
    </div>
  );
}`,
  },
  {
    id: "performance",
    name: "Performance Analyzer",
    description: "Find re-render issues, missing memoization & bundle optimizations",
    icon: "⚡",
    inputType: "code",
    placeholder: "Paste your React component or hook here...",
    sample: `import { useState } from 'react';
import _ from 'lodash';
import moment from 'moment';

function ProductList({ products, filters }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('name');

  const filteredProducts = products
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .filter(p => filters.every(f => p.tags.includes(f)))
    .sort((a, b) => a[sortKey] > b[sortKey] ? 1 : -1)
    .map(p => ({
      ...p,
      formattedDate: moment(p.createdAt).format('MMMM Do YYYY'),
      slug: _.kebabCase(p.name),
    }));

  return (
    <div>
      <input value={search} onChange={e => setSearch(e.target.value)} />
      {filteredProducts.map(product => (
        <ProductCard key={product.id} product={product} filters={filters} onSort={setSortKey} />
      ))}
    </div>
  );
}

function ProductCard({ product, filters, onSort }) {
  const expensive = heavyComputation(product);
  return <div>{product.name} - {expensive}</div>;
}

function heavyComputation(p) {
  let result = 0;
  for (let i = 0; i < 100000; i++) result += i;
  return result;
}`,
  },
  {
    id: "bundle",
    name: "Bundle Analyzer",
    description: "Analyze imports & dependencies for bundle size optimizations",
    icon: "📦",
    inputType: "code",
    placeholder: "Paste your package.json, import statements, or webpack stats JSON...",
    sample: `// Imports from a typical React project
import _ from 'lodash';
import moment from 'moment';
import * as icons from '@fortawesome/free-solid-svg-icons';
import { BrowserRouter, Route, Switch } from 'react-router-dom';
import axios from 'axios';
import { connect } from 'react-redux';
import styled from 'styled-components';
import { DatePicker } from 'antd';
import Chart from 'chart.js';
import { Editor } from '@tinymce/tinymce-react';
import * as Sentry from '@sentry/react';
import numeral from 'numeral';
import uuid from 'uuid';

// package.json dependencies:
// "lodash": "^4.17.21",       // 71KB gzipped
// "moment": "^2.29.4",        // 67KB gzipped  
// "chart.js": "^4.4.0",       // 55KB gzipped
// "antd": "^5.0.0",           // 250KB gzipped
// "@fortawesome/free-solid-svg-icons": "^6.4.0"  // 400KB gzipped`,
  },
  {
    id: "lighthouse",
    name: "Lighthouse Analyzer",
    description: "Interpret Lighthouse scores and get a Core Web Vitals action plan",
    icon: "🔦",
    inputType: "text",
    placeholder: "Paste your Lighthouse JSON report, or describe your scores...",
    sample: `Lighthouse Report for: https://myshop.com

Performance: 42
Accessibility: 78  
Best Practices: 83
SEO: 91

Core Web Vitals:
- LCP (Largest Contentful Paint): 5.8s  [POOR]
- FID (First Input Delay): 280ms  [NEEDS IMPROVEMENT]
- CLS (Cumulative Layout Shift): 0.28  [POOR]
- TTFB (Time to First Byte): 1.4s
- TTI (Time to Interactive): 8.2s
- TBT (Total Blocking Time): 620ms

Top Opportunities:
- Remove unused JavaScript: 1.8MB potential savings
- Properly size images: 840KB potential savings  
- Eliminate render-blocking resources: 4 resources
- Reduce server response times (TTFB): 1.4s
- Serve images in next-gen formats: 620KB savings
- Use video formats for animated content: 1.2MB savings`,
  },
];
