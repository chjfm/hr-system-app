export default function Home() {
  return (
    <>
      <section className="kpis">
        <div className="kpi lead">
          <span className="k">재직 인원</span>
          <span className="v">–</span>
          <span className="s">전체 직원 중</span>
        </div>
        <div className="kpi">
          <span className="k">휴직</span>
          <span className="v">–</span>
          <span className="s">명</span>
        </div>
        <div className="kpi">
          <span className="k">퇴사</span>
          <span className="v">–</span>
          <span className="s">누적</span>
        </div>
        <div className="kpi">
          <span className="k">부서 수</span>
          <span className="v">–</span>
          <span className="s">개</span>
        </div>
      </section>

      <div className="card">
        <div className="card-head">
          <h3>직원 대장</h3>
          <span className="unit">단위 · 명</span>
        </div>
        <div className="t-empty">
          데이터베이스 연결 준비 중입니다. 다음 단계에서 직원 목록이 표시됩니다.
        </div>
      </div>

      <div className="callout">
        <b>배포 확인용 초기 화면입니다.</b> 이 페이지가 보이면 GitHub → Vercel 자동 배포가
        정상 동작하는 것입니다. 이후 Supabase를 연결해 직원 목록·등록·검색·퇴사 처리를 붙입니다.
      </div>
    </>
  );
}
