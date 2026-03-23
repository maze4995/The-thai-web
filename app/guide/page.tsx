import { Metadata } from 'next'

export const metadata: Metadata = {
  title: '사용 가이드 - The Thai Web',
}

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f1117] text-slate-800 dark:text-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white dark:bg-[#161b27] border-b border-slate-200 dark:border-slate-700/60 px-4 py-3 flex items-center justify-between">
        <h1 className="text-base font-bold text-emerald-600 dark:text-emerald-400">The Thai Web 사용 가이드</h1>
        <a
          href="/"
          className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-700 rounded text-xs text-slate-600 dark:text-slate-300 transition-colors"
        >
          조판지로 돌아가기
        </a>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-12">
        {/* TOC */}
        <nav className="bg-white dark:bg-[#161b27] rounded-xl border border-slate-200 dark:border-slate-700/60 p-5">
          <h2 className="font-bold text-sm mb-3 text-slate-900 dark:text-slate-100">목차</h2>
          <ol className="space-y-1.5 text-sm text-emerald-600 dark:text-emerald-400">
            <li><a href="#overview" className="hover:underline">1. 조판지 화면 구성</a></li>
            <li><a href="#date" className="hover:underline">2. 날짜 이동하기</a></li>
            <li><a href="#manager" className="hover:underline">3. 담당자 설정하기</a></li>
            <li><a href="#add-slot" className="hover:underline">4. 슬롯 추가하기</a></li>
            <li><a href="#arrival" className="hover:underline">5. 손님 도착 처리</a></li>
            <li><a href="#edit-slot" className="hover:underline">6. 슬롯 수정 / 삭제</a></li>
            <li><a href="#drag" className="hover:underline">7. 드래그 앤 드롭</a></li>
            <li><a href="#theme" className="hover:underline">8. 다크모드 / 라이트모드</a></li>
            <li><a href="#stats" className="hover:underline">9. 주별 통계 보기</a></li>
            <li><a href="#therapist" className="hover:underline">10. 관리사 관리</a></li>
          </ol>
        </nav>

        {/* 1. Overview */}
        <section id="overview" className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">1. 조판지 화면 구성</h2>
          <p className="text-sm leading-relaxed">조판지는 크게 <b>상단바</b>, <b>메인 보드</b>, <b>하단 매출 요약</b> 세 영역으로 구성되어 있습니다.</p>

          {/* Mock overview */}
          <div className="rounded-xl border border-slate-300 dark:border-slate-700 overflow-hidden text-xs">
            {/* Mock header */}
            <div className="bg-white dark:bg-[#161b27] border-b border-slate-200 dark:border-slate-700 px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">The Thai</span>
                <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-500">담당자</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-[10px]">←</span>
                <span className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px]">오늘</span>
                <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px]">2026-03-24</span>
                <span className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-[10px]">→</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[10px]">통계</span>
                <span className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[10px]">관리사</span>
              </div>
            </div>
            {/* Mock board */}
            <div className="bg-slate-100 dark:bg-[#0f1117] p-2 flex gap-2">
              {['지나', '린다', '아이유'].map(name => (
                <div key={name} className="flex-1 bg-white dark:bg-[#161b27] rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="bg-slate-50 dark:bg-[#1a2035] px-2 py-1.5 border-b border-slate-200 dark:border-slate-700 flex justify-between">
                    <span className="font-bold text-[10px]">{name}</span>
                    <span className="text-[9px] text-slate-500 bg-slate-200 dark:bg-slate-800 px-1 rounded-full">2/7</span>
                  </div>
                  <div className="p-1.5 space-y-1">
                    <div className="bg-slate-50 dark:bg-[#1e2535] rounded p-1.5 border border-slate-200 dark:border-slate-700">
                      <div className="flex justify-between"><span className="font-bold text-[9px]">1234</span><span className="text-[8px] bg-slate-200 dark:bg-slate-700 px-1 rounded">7번방</span></div>
                      <div className="flex justify-between mt-0.5"><span className="text-emerald-500 text-[9px]">T60</span><span className="text-[8px] text-emerald-600 bg-emerald-100 dark:bg-emerald-900 px-1 rounded">현금 4만</span></div>
                    </div>
                    <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded h-8 flex items-center justify-center text-slate-400 text-[9px]">+ 추가</div>
                  </div>
                </div>
              ))}
            </div>
            {/* Mock footer */}
            <div className="bg-white dark:bg-[#161b27] border-t border-slate-200 dark:border-slate-700 px-3 py-1.5 flex gap-3 text-[10px]">
              <span><span className="text-slate-400">총매출</span> <b>12만</b></span>
              <span><span className="text-emerald-500">현금</span> 8만</span>
              <span><span className="text-blue-400">카드</span> 4만</span>
              <span><span className="text-slate-400">총고객</span> 6명</span>
            </div>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 text-xs space-y-1">
            <p><b className="text-emerald-700 dark:text-emerald-400">상단바:</b> 담당자, 날짜 이동, 오늘 버튼, 통계/관리사 페이지 링크</p>
            <p><b className="text-emerald-700 dark:text-emerald-400">메인 보드:</b> 출근한 관리사별 슬롯 (세로 칸)</p>
            <p><b className="text-emerald-700 dark:text-emerald-400">하단 요약:</b> 총매출, 결제수단별 금액, 쿠폰/신규/로드 집계, 커미션</p>
          </div>
        </section>

        {/* 2. Date */}
        <section id="date" className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">2. 날짜 이동하기</h2>

          <div className="flex items-center justify-center gap-2 bg-white dark:bg-[#161b27] rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center text-sm font-bold relative">
                ←
                <div className="absolute -bottom-5 text-[9px] text-slate-500 whitespace-nowrap">전날</div>
              </div>
              <div className="px-3 h-8 bg-emerald-600 text-white rounded-lg flex items-center text-xs font-bold relative">
                오늘
                <div className="absolute -bottom-5 text-[9px] text-emerald-600 dark:text-emerald-400 whitespace-nowrap">오늘로 이동</div>
              </div>
              <div className="h-8 px-3 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center text-xs font-semibold relative">
                2026-03-24
                <div className="absolute -bottom-5 text-[9px] text-blue-500 whitespace-nowrap">클릭하면 달력</div>
              </div>
              <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center text-sm font-bold relative">
                →
                <div className="absolute -bottom-5 text-[9px] text-slate-500 whitespace-nowrap">다음날</div>
              </div>
            </div>
          </div>

          <div className="text-sm leading-relaxed space-y-2">
            <p><b>← / →</b> 버튼으로 하루씩 이동합니다.</p>
            <p><b>오늘</b> 버튼을 누르면 오늘 조판지로 바로 돌아옵니다.</p>
            <p><b>날짜</b>를 클릭하면 달력이 열려서 원하는 날짜를 직접 선택할 수 있습니다.</p>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs">
            <b className="text-amber-700 dark:text-amber-400">참고:</b> 영업일은 오전 6시부터 다음날 오전 6시까지입니다. 자정 이후의 예약도 같은 날 조판지에 표시됩니다.
          </div>
        </section>

        {/* 3. Manager */}
        <section id="manager" className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">3. 담당자 설정하기</h2>

          <div className="bg-white dark:bg-[#161b27] rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-sm">1단계:</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">The Thai</span>
                <button className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs text-slate-500 border border-slate-200 dark:border-slate-700">담당자</button>
              </div>
              <span className="text-xs text-slate-500">← 이 버튼을 클릭</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm">2단계:</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">The Thai</span>
                <input className="w-20 px-2 py-0.5 bg-slate-50 dark:bg-slate-800 border border-emerald-500 rounded text-xs" defaultValue="HYUN" readOnly />
              </div>
              <span className="text-xs text-slate-500">← 이름 입력 후 Enter</span>
            </div>
          </div>
          <p className="text-sm">각 날짜마다 담당자가 독립적으로 저장됩니다.</p>
        </section>

        {/* 4. Add Slot */}
        <section id="add-slot" className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">4. 슬롯 추가하기</h2>

          <p className="text-sm leading-relaxed">슬롯을 추가하는 방법은 <b>2가지</b>입니다.</p>

          {/* Method 1 */}
          <div className="bg-white dark:bg-[#161b27] rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
            <h3 className="font-bold text-sm text-emerald-600 dark:text-emerald-400">방법 1: 예약에서 선택 (자동)</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">모바일 앱에서 들어온 예약은 자동으로 조판지에 생성됩니다. 하지만 수동으로도 선택할 수 있습니다.</p>
            <div className="space-y-2">
              <p className="text-xs"><b>1.</b> 빈 슬롯의 <span className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[10px]">+ 추가</span> 버튼 클릭</p>
              <p className="text-xs"><b>2.</b> "예약에서 선택" 탭에서 원하는 예약을 터치</p>
              <p className="text-xs"><b>3.</b> 고객 정보가 자동으로 채워짐 → 저장</p>
            </div>

            {/* Mock reservation list */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="flex border-b border-slate-200 dark:border-slate-700">
                <div className="flex-1 py-1.5 text-center text-xs font-medium text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500">예약에서 선택</div>
                <div className="flex-1 py-1.5 text-center text-xs text-slate-400">직접 입력</div>
              </div>
              <div className="p-2 space-y-1.5 bg-slate-50 dark:bg-[#0f1117]">
                <div className="bg-white dark:bg-[#1e2535] p-2 rounded border border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between"><span className="font-semibold text-xs">홍길동</span><span className="text-[10px] text-slate-500">14:00</span></div>
                  <div className="flex gap-2 mt-0.5"><span className="text-[10px] text-slate-500">010-1234-5678</span><span className="text-emerald-500 text-[10px]">타이 60분</span></div>
                </div>
                <div className="bg-white dark:bg-[#1e2535] p-2 rounded border border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between"><span className="font-semibold text-xs">김철수</span><span className="text-[10px] text-slate-500">15:30</span></div>
                  <div className="flex gap-2 mt-0.5"><span className="text-[10px] text-slate-500">010-9876-5432</span><span className="text-emerald-500 text-[10px]">아로마 90분</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Method 2 */}
          <div className="bg-white dark:bg-[#161b27] rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
            <h3 className="font-bold text-sm text-emerald-600 dark:text-emerald-400">방법 2: 직접 입력</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">워크인(예약 없이 방문) 손님이나 전화 예약 시 사용합니다.</p>
            <div className="space-y-2">
              <p className="text-xs"><b>1.</b> <span className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[10px]">+ 추가</span> 클릭 → "직접 입력" 탭</p>
              <p className="text-xs"><b>2.</b> 고객명, 전화번호(필수), 서비스, 방번호, 결제방식 입력</p>
              <p className="text-xs"><b>3.</b> 저장 버튼 클릭</p>
            </div>

            {/* Mock form */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-[#0f1117] space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-[9px] text-slate-500">고객명</span><div className="mt-0.5 bg-white dark:bg-[#161b27] border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs">홍길동</div></div>
                <div><span className="text-[9px] text-slate-500">전화번호 *</span><div className="mt-0.5 bg-white dark:bg-[#161b27] border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs">010-1234-5678</div></div>
              </div>
              <div>
                <span className="text-[9px] text-slate-500">서비스</span>
                <div className="flex gap-1 mt-0.5 flex-wrap">
                  {['T60','T90','A60','A90','C60','C90','S60','S90'].map(s => (
                    <span key={s} className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${s === 'T60' ? 'bg-emerald-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{s}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs">
            <b className="text-blue-700 dark:text-blue-400">자동 배정:</b> 모바일 앱에서 예약이 들어오면 자동으로 왼쪽 관리사부터 순서대로 배정됩니다. 방번호도 서비스 종류에 따라 자동 배정됩니다.
            <div className="mt-1.5 space-y-0.5">
              <p>T60, T90 (타이) → 7, 3, 6번방 순서</p>
              <p>S60, S90 (스웨디시) → 5, 2, 1번방 순서</p>
            </div>
          </div>
        </section>

        {/* 5. Arrival */}
        <section id="arrival" className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">5. 손님 도착 처리</h2>

          <div className="bg-white dark:bg-[#161b27] rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
            <div className="flex gap-6 items-start justify-center">
              {/* Before */}
              <div className="text-center space-y-2">
                <span className="text-xs font-medium text-slate-500">도착 전</span>
                <div className="w-40 bg-slate-50 dark:bg-[#1e2535] rounded-lg p-2 border border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between"><span className="font-bold text-xs">5678</span><span className="text-[9px] bg-slate-200 dark:bg-slate-700 px-1 rounded">7번방</span></div>
                  <div className="flex justify-between mt-1"><span className="text-emerald-500 text-xs">T60</span><span className="text-[9px] bg-emerald-100 dark:bg-emerald-900 text-emerald-600 px-1 rounded">현금 4만</span></div>
                  <div className="mt-1 space-y-0.5 text-[9px]">
                    <div className="flex justify-between"><span className="text-amber-500">예약</span><span>14:00</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">입</span><span>--:--</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">출</span><span>--:--</span></div>
                  </div>
                  <button className="w-full mt-1.5 py-1 bg-amber-500 text-white text-[10px] font-bold rounded">손님도착</button>
                </div>
              </div>

              {/* Arrow */}
              <div className="mt-12 text-2xl text-slate-400">→</div>

              {/* After */}
              <div className="text-center space-y-2">
                <span className="text-xs font-medium text-slate-500">도착 후</span>
                <div className="w-40 bg-slate-50 dark:bg-[#1e2535] rounded-lg p-2 border border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between"><span className="font-bold text-xs">5678</span><span className="text-[9px] bg-slate-200 dark:bg-slate-700 px-1 rounded">7번방</span></div>
                  <div className="flex justify-between mt-1"><span className="text-emerald-500 text-xs">T60</span><span className="text-[9px] bg-emerald-100 dark:bg-emerald-900 text-emerald-600 px-1 rounded">현금 4만</span></div>
                  <div className="mt-1 space-y-0.5 text-[9px]">
                    <div className="flex justify-between"><span className="text-amber-500">예약</span><span>14:00</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">입</span><span className="font-medium">14:10</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">출</span><span className="font-medium">15:10</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-sm leading-relaxed space-y-2">
            <p><b className="text-amber-500">손님도착</b> 버튼을 누르면:</p>
            <p>- <b>입실시간</b>이 현재 시각의 가장 가까운 10분 단위로 자동 설정됩니다</p>
            <p>- 예) 14:05에 누르면 → 14:10, 14:12에 누르면 → 14:20</p>
            <p>- <b>퇴실시간</b>은 서비스 시간에 따라 자동 계산됩니다 (T60=60분 후)</p>
          </div>

          {/* Finished badge */}
          <div className="bg-white dark:bg-[#161b27] rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
            <h3 className="font-bold text-sm">관리 완료 표시</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">퇴실시간이 지나면 슬롯에 <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded">완료</span> 뱃지가 자동으로 표시됩니다.</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">관리사가 현재 관리 중이면 이름 옆에 <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">관리중</span> 뱃지가 깜빡입니다.</p>
          </div>
        </section>

        {/* 6. Edit/Delete */}
        <section id="edit-slot" className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">6. 슬롯 수정 / 삭제</h2>

          <div className="text-sm leading-relaxed space-y-2">
            <p><b>슬롯을 클릭(터치)</b>하면 수정 창이 열립니다.</p>
            <p>고객명, 서비스, 방번호, 결제방식, 시간, 비고 등 모든 항목을 수정할 수 있습니다.</p>
            <p>왼쪽 하단의 <span className="bg-red-900/40 text-red-400 px-2 py-0.5 rounded text-xs">삭제</span> 버튼으로 슬롯을 삭제할 수 있습니다.</p>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs">
            <b className="text-amber-700 dark:text-amber-400">주의:</b> 삭제한 슬롯은 복구할 수 없습니다. 삭제 전 확인 창이 나타납니다.
          </div>
        </section>

        {/* 7. Drag & Drop */}
        <section id="drag" className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">7. 드래그 앤 드롭</h2>

          <p className="text-sm leading-relaxed">컴퓨터에서 마우스로 끌어서 놓기(드래그 앤 드롭)를 지원합니다.</p>

          {/* Slot drag */}
          <div className="bg-white dark:bg-[#161b27] rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
            <h3 className="font-bold text-sm text-blue-600 dark:text-blue-400">슬롯 이동: 다른 관리사에게 배정 변경</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">슬롯 카드를 잡고 다른 관리사 칸으로 끌어다 놓으면 배정이 변경됩니다.</p>
            <div className="flex gap-3 items-center justify-center">
              <div className="w-32 bg-slate-50 dark:bg-[#1e2535] rounded-lg border border-slate-200 dark:border-slate-700 p-1.5">
                <div className="text-[10px] font-bold text-center mb-1 text-slate-500">지나</div>
                <div className="bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-400 border-dashed rounded p-1 text-center text-[9px] opacity-50">5678 T60</div>
              </div>
              <span className="text-lg text-blue-500">→</span>
              <div className="w-32 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-300 dark:border-emerald-700 p-1.5">
                <div className="text-[10px] font-bold text-center mb-1 text-slate-500">린다</div>
                <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded p-1 text-center text-[9px] text-slate-400">여기에 놓기</div>
              </div>
            </div>
          </div>

          {/* Column drag */}
          <div className="bg-white dark:bg-[#161b27] rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
            <h3 className="font-bold text-sm text-purple-600 dark:text-purple-400">관리사 순서 변경</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">관리사 이름 부분(헤더)을 잡고 좌/우로 끌면 순서가 바뀝니다. 초록색 세로 선이 놓일 위치를 안내합니다.</p>
            <div className="flex gap-1 items-center justify-center">
              <div className="w-20 bg-slate-50 dark:bg-[#1e2535] rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-center">
                <span className="text-[10px] font-bold">린다</span>
              </div>
              <div className="w-1 h-12 bg-emerald-500 rounded" />
              <div className="w-20 bg-slate-50 dark:bg-[#1e2535] rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-center opacity-50">
                <span className="text-[10px] font-bold">지나</span>
              </div>
              <div className="w-20 bg-slate-50 dark:bg-[#1e2535] rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-center">
                <span className="text-[10px] font-bold">아이유</span>
              </div>
            </div>
            <p className="text-[10px] text-center text-slate-500">↑ 지나를 린다 왼쪽으로 이동하는 모습</p>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs">
            <b className="text-amber-700 dark:text-amber-400">참고:</b> 관리사 순서는 날짜별로 독립적으로 저장됩니다.
          </div>
        </section>

        {/* 8. Theme */}
        <section id="theme" className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">8. 다크모드 / 라이트모드</h2>

          <div className="text-sm leading-relaxed space-y-2">
            <p>상단 오른쪽의 해/달 아이콘 버튼으로 전환합니다.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-center space-y-2">
              <span className="text-2xl">☀️</span>
              <p className="text-xs font-medium text-slate-700">라이트 모드</p>
              <p className="text-[10px] text-slate-500">밝은 환경에서 사용</p>
            </div>
            <div className="bg-[#161b27] border border-slate-700 rounded-xl p-4 text-center space-y-2">
              <span className="text-2xl">🌙</span>
              <p className="text-xs font-medium text-slate-200">다크 모드</p>
              <p className="text-[10px] text-slate-400">어두운 환경에서 사용</p>
            </div>
          </div>
        </section>

        {/* 9. Stats */}
        <section id="stats" className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">9. 주별 통계 보기</h2>

          <div className="text-sm leading-relaxed space-y-2">
            <p>상단 <span className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-xs">통계</span> 버튼을 누르면 주별 매출 통계 페이지로 이동합니다.</p>
          </div>

          <div className="bg-white dark:bg-[#161b27] rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
            <h3 className="font-bold text-sm">통계 페이지에서 볼 수 있는 정보</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 dark:bg-[#0f1117] rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                <p className="font-bold text-emerald-600 dark:text-emerald-400 mb-1">주간 매출 요약</p>
                <p className="text-[10px] text-slate-500">총매출, 현금/카드/이체 합계</p>
              </div>
              <div className="bg-slate-50 dark:bg-[#0f1117] rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                <p className="font-bold text-blue-600 dark:text-blue-400 mb-1">일별 매출 표</p>
                <p className="text-[10px] text-slate-500">월~일 각 날짜 매출</p>
              </div>
              <div className="bg-slate-50 dark:bg-[#0f1117] rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                <p className="font-bold text-purple-600 dark:text-purple-400 mb-1">관리사별 커미션</p>
                <p className="text-[10px] text-slate-500">이름, 건수, 커미션 합계</p>
              </div>
              <div className="bg-slate-50 dark:bg-[#0f1117] rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                <p className="font-bold text-amber-600 dark:text-amber-400 mb-1">고객 집계</p>
                <p className="text-[10px] text-slate-500">신규, 로드, 쿠폰, 문자할인 등</p>
              </div>
            </div>
          </div>
        </section>

        {/* 10. Therapist management */}
        <section id="therapist" className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">10. 관리사 관리</h2>

          <div className="text-sm leading-relaxed space-y-2">
            <p>상단 <span className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-xs">관리사</span> 버튼으로 관리사 관리 페이지에 접속합니다.</p>
          </div>

          <div className="bg-white dark:bg-[#161b27] rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
            <h3 className="font-bold text-sm">할 수 있는 것</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold">+</span>
                <span>새 관리사 추가</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600 flex items-center justify-center text-[10px]">출근</span>
                <span>출근 / 퇴근 처리 (토글 버튼)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-[10px]">▲▼</span>
                <span>관리사 기본 순서 변경</span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs">
            <b className="text-blue-700 dark:text-blue-400">중요:</b> 관리사 페이지에서 출근 처리를 해야 조판지에 표시됩니다.
          </div>
        </section>

        {/* Quick Reference */}
        <section className="bg-white dark:bg-[#161b27] rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">빠른 참고</h2>
          <div className="space-y-2 text-xs">
            <div className="flex gap-2 items-start">
              <span className="shrink-0 w-20 font-bold text-slate-500">고객명 규칙</span>
              <div className="space-y-0.5">
                <p><span className="text-rose-500">로드-New-</span> → 비고: 신규로드</p>
                <p><span className="text-orange-500">로드</span> (New 없음) → 비고: 기존로드</p>
                <p><span className="text-cyan-500">마통-New-</span> → 비고: 마통신규</p>
                <p><span className="text-cyan-500">하이-New-</span> → 비고: 하이신규</p>
                <p><span className="text-cyan-500">마맵-New-</span> → 비고: 마맵신규</p>
                <p><span className="text-cyan-500">New</span> (방문횟수 (0)(0)일 때만) → 비고: 신규</p>
              </div>
            </div>
            <div className="flex gap-2 items-start">
              <span className="shrink-0 w-20 font-bold text-slate-500">로드 가격</span>
              <div className="space-y-0.5">
                <p>T60: 6만 / T90: 8만 / A60: 7만 / A90: 9만</p>
                <p>C60: 8만 / C90: 10만 / S60: 8만 / S90: 10만</p>
              </div>
            </div>
            <div className="flex gap-2 items-start">
              <span className="shrink-0 w-20 font-bold text-slate-500">어플 가격</span>
              <div className="space-y-0.5">
                <p>T60: 4만 / T90: 6만 / A60: 5만 / A90: 7만</p>
                <p>C60: 6만 / C90: 8만 / S60: 7만 / S90: 9만</p>
              </div>
            </div>
          </div>
        </section>

        <p className="text-center text-xs text-slate-400 dark:text-slate-600 pb-4">
          The Thai Web v1.0 사용 가이드
        </p>
      </main>
    </div>
  )
}
