import React from 'react';

/**
 * Menangkap error render React supaya satu crash tidak membuat
 * seluruh halaman blank (black screen). Menampilkan pesan error
 * yang bisa dibaca + tombol reset.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="container">
          <div className="card">
            <h2>Terjadi Error</h2>
            <div className="alert alert-error">
              {String(this.state.error?.message || this.state.error)}
            </div>
            <div className="btn-row">
              <button className="btn btn-primary" onClick={this.reset}>Coba Lagi</button>
              <button className="btn btn-outline" onClick={() => window.location.reload()}>Muat Ulang Halaman</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
