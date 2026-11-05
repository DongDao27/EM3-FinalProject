import Link from "next/link";
export default function NotFound() {
  return (
    <section className="container empty-state">
      <h1>Không tìm thấy trang</h1>
      <p>Trang này không tồn tại hoặc đã được chuyển.</p>
      <Link className="button primary" href="/">
        Về trang chủ
      </Link>
    </section>
  );
}
