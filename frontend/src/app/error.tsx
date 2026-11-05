"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="container page-section">
      <h1>Chưa thể tải nội dung</h1>
      <p>Vui lòng thử lại sau ít phút.</p>
      <button className="button" onClick={reset}>
        Thử lại
      </button>
    </section>
  );
}
