import "../styles/globals.css";
import Head from "next/head";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem("theme") || "dark";
                  document.documentElement.setAttribute("data-theme", t);
                } catch(e) {}
              })();
            `
          }}
        />
      </Head>
      <Component {...pageProps} />
    </>
  );
}